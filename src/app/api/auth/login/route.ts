export async function POST() {
  console.log("LOGIN ROUTE EXECUTADA");
  return Response.json({
    success: true,
    teste: true
  });
}

// POST /api/auth/logout
export async function DELETE(_req: NextRequest) {
  const res = NextResponse.json({ success: true, message: "SessÃ£o encerrada." });
  res.cookies.set("omnizeus_session", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}



