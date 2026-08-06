import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const cache = new Map<string, { name: string | null; address: string | null; expiresAt: number }>();
const TTL_MS = 10 * 60 * 1000; // 10 min

function shortAddress(addr: Record<string, string | undefined>): string {
  const road = addr.road ?? addr.pedestrian ?? addr.footway ?? addr.path ?? "";
  const num = addr.house_number ? `, ${addr.house_number}` : "";
  const area =
    addr.suburb ?? addr.neighbourhood ?? addr.city_district ?? addr.village ?? addr.town ?? addr.city ?? "";
  const parts = [road ? `${road}${num}` : "", area].filter(Boolean);
  return parts.join(" — ");
}

const reverseSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const reverseGeocode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => reverseSchema.parse(data))
  .handler(async ({ data }) => {
    const key = `${data.lat.toFixed(4)}_${data.lng.toFixed(4)}`;
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      return { name: cached.name, address: cached.address, source: "nominatim" as const };
    }

    try {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("lat", String(data.lat));
      url.searchParams.set("lon", String(data.lng));
      url.searchParams.set("zoom", "18");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("namedetails", "1");
      url.searchParams.set("accept-language", "pt-BR,pt,en");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url.toString(), {
        headers: {
          "User-Agent": "FitCrew/1.0 (contato@fitcrew.app)",
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) throw new Error(`nominatim ${res.status}`);
      const json: any = await res.json();

      const addr = (json.address ?? {}) as Record<string, string>;
      const cat = json.category as string | undefined;
      const type = json.type as string | undefined;
      const poiName = json.namedetails?.name ?? json.name ?? null;

      // Priorizar POI se for academia / esporte / lazer / restaurante etc
      const isPoi =
        !!poiName &&
        (cat === "leisure" ||
          cat === "sport" ||
          type === "gym" ||
          type === "fitness_centre" ||
          type === "fitness_station" ||
          type === "sports_centre" ||
          type === "stadium" ||
          type === "park" ||
          cat === "amenity");

      const short = shortAddress(addr);
      const name = isPoi ? poiName : short || (json.display_name?.split(",").slice(0, 2).join(",") ?? null);
      const address = (json.display_name as string | null) ?? null;

      cache.set(key, { name, address, expiresAt: now + TTL_MS });
      return { name, address, source: "nominatim" as const };
    } catch {
      cache.set(key, { name: null, address: null, expiresAt: now + 60_000 });
      return { name: null, address: null, source: "nominatim" as const };
    }
  });
