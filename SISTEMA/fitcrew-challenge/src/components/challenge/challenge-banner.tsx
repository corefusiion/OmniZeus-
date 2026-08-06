import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImageIcon } from "lucide-react";
import { getBannerSignedUrl } from "@/lib/challenge-banner.functions";

interface Props {
  bannerPath: string | null | undefined;
  name: string;
}

export function ChallengeBanner({ bannerPath, name }: Props) {
  const urlFn = useServerFn(getBannerSignedUrl);
  const { data, isLoading } = useQuery({
    queryKey: ["challenge-banner-url", bannerPath],
    queryFn: () => urlFn({ data: { path: bannerPath! } }),
    enabled: !!bannerPath,
    staleTime: 1000 * 60 * 60, // 1h
  });

  const url = data?.url;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl shadow-soft ring-1 ring-border">
      <div className="relative h-32 w-full md:h-48 lg:h-56">
        {url ? (
          <img
            src={url}
            alt={`Capa do desafio ${name}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 via-primary/10 to-orange-500/20">
            {bannerPath && isLoading ? (
              <div className="size-8 animate-pulse rounded-full bg-primary/30" />
            ) : (
              <ImageIcon className="size-10 text-primary/50" aria-hidden />
            )}
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h2 className="line-clamp-2 font-display text-xl font-black text-white drop-shadow-md md:text-2xl">
            {name}
          </h2>
        </div>
      </div>
    </div>
  );
}
