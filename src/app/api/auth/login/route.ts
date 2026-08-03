export const runtime = "edge";

export async function POST() {
  console.log("LOGIN ROUTE EXECUTADA");
  return Response.json({
    success: true,
    teste: true
  });
}



