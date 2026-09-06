export const runtime = "nodejs";
export function GET() {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>P.A.T.C.H. Backend API</title><link rel="stylesheet" href="/api/docs/assets/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="/api/docs/assets/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:'/api/openapi',dom_id:'#swagger-ui',withCredentials:true,persistAuthorization:false,validatorUrl:null});</script></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
