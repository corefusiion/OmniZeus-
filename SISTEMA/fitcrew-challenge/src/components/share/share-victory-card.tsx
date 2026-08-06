import { forwardRef } from "react";

export type ShareVictoryData = {
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  challengeName: string;
  position: number;
  totalPoints: number;
  countedDays: number;
};

/**
 * Story-sized (1080x1920) victory card rendered off-screen and captured via html-to-image.
 * Do NOT display in normal flow — the parent must position it fixed & off-screen.
 */
export const ShareVictoryCard = forwardRef<HTMLDivElement, { data: ShareVictoryData }>(
  ({ data }, ref) => {
    const medal =
      data.position === 1 ? "🥇"
      : data.position === 2 ? "🥈"
      : data.position === 3 ? "🥉"
      : `#${data.position}`;
    const headline =
      data.position === 1 ? "Estou em 1º Lugar!"
      : data.position <= 3 ? `Estou no Pódio! ${medal}`
      : `Já estou no Top ${data.position}`;

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: 1920,
          background: "linear-gradient(160deg, #0a0a0a 0%, #1a0a04 40%, #ff5a1f 100%)",
          fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
          color: "#fff",
          padding: 96,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Top: FitCrew brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              background: "linear-gradient(135deg, #ff5a1f, #ffb84d)",
              display: "grid",
              placeItems: "center",
              fontSize: 36,
              fontWeight: 900,
            }}
          >
            🔥
          </div>
          <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: 2 }}>FITCREW</span>
        </div>

        {/* Middle: content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          <p
            style={{
              fontSize: 44,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 4,
              color: "#ffb84d",
              margin: 0,
            }}
          >
            {data.challengeName}
          </p>

          <h1
            style={{
              fontSize: 148,
              fontWeight: 900,
              lineHeight: 0.95,
              margin: 0,
              letterSpacing: -2,
            }}
          >
            {headline}
          </h1>

          <div style={{ display: "flex", alignItems: "center", gap: 32, marginTop: 24 }}>
            {data.avatarUrl ? (
              <img
                src={data.avatarUrl}
                alt=""
                crossOrigin="anonymous"
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: "50%",
                  border: "6px solid #ff5a1f",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: "50%",
                  border: "6px solid #ff5a1f",
                  background: "#333",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 72,
                  fontWeight: 900,
                }}
              >
                {data.displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ fontSize: 56, fontWeight: 900, margin: 0 }}>{data.displayName}</p>
              {data.username && (
                <p style={{ fontSize: 36, opacity: 0.7, margin: 0 }}>@{data.username}</p>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 32,
              marginTop: 24,
            }}
          >
            <div
              style={{
                flex: 1,
                padding: 40,
                borderRadius: 32,
                background: "rgba(255,255,255,0.08)",
                border: "2px solid rgba(255,90,31,0.4)",
              }}
            >
              <p style={{ fontSize: 32, opacity: 0.7, margin: 0, textTransform: "uppercase", letterSpacing: 2 }}>
                Pontos
              </p>
              <p style={{ fontSize: 128, fontWeight: 900, margin: 0, lineHeight: 1, color: "#ff5a1f" }}>
                {data.totalPoints}
              </p>
            </div>
            <div
              style={{
                flex: 1,
                padding: 40,
                borderRadius: 32,
                background: "rgba(255,255,255,0.08)",
                border: "2px solid rgba(255,255,255,0.15)",
              }}
            >
              <p style={{ fontSize: 32, opacity: 0.7, margin: 0, textTransform: "uppercase", letterSpacing: 2 }}>
                Dias treinados
              </p>
              <p style={{ fontSize: 128, fontWeight: 900, margin: 0, lineHeight: 1 }}>
                {data.countedDays}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom: CTA */}
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 48, fontWeight: 900, margin: 0 }}>
            Bate de frente comigo. 💪
          </p>
          <p style={{ fontSize: 36, opacity: 0.8, marginTop: 12 }}>
            fitcrew.lovable.app
          </p>
        </div>
      </div>
    );
  },
);
ShareVictoryCard.displayName = "ShareVictoryCard";
