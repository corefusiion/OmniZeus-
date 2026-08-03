export const runtime = "edge";

export async function POST(request: Request) {
  console.log("=== LOGIN INICIO ===");

  try {
    const body = await request.text();

    console.log("BODY:", body);

    return Response.json({
      success: true,
      etapa: "route-executada",
      body
    });

  } catch (e) {
    console.error("ERRO INTERNO", e);

    return Response.json(
      {
        success: false,
        erro: String(e)
      },
      { status: 500 }
    );
  }
}



