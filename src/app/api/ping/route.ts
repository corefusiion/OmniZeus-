export const runtime = "edge";

export async function GET() {
  return new Response("pong", {
    status: 200,
    headers: {
      "content-type": "text/plain"
    }
  });
}
