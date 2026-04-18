const SWAGGER_UI_VERSION = "5.18.2";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const specUrl = `${origin}/api/v1/openapi`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WealthClick API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css" />
  <style>
    body { margin: 0; background: #0a0a0f; }
    .swagger-ui .topbar { background: #0a0a0f; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
    .swagger-ui .info .title { color: #fff; }
    .swagger-ui .info p, .swagger-ui .info li { color: rgba(255,255,255,0.65); }
    .swagger-ui .scheme-container { background: #13131a; box-shadow: none; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .swagger-ui section.models { background: #13131a; }
    .swagger-ui .opblock-tag { color: rgba(255,255,255,0.75); border-bottom: 1px solid rgba(255,255,255,0.08); }
    .swagger-ui .opblock { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); }
    .swagger-ui .opblock .opblock-summary-description { color: rgba(255,255,255,0.55); }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: "${specUrl}",
        dom_id: "#swagger-ui",
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: "BaseLayout",
        deepLinking: true,
        persistAuthorization: true,
      });
    };
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
