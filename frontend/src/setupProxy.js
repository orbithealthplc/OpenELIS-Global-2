const { createProxyMiddleware } = require("http-proxy-middleware");
const fs = require("fs");

module.exports = function (app) {
  // Host CRA uses localhost:8443. Inside the frontend Docker container,
  // 127.0.0.1:8443 is the FE itself — use the compose service DNS name.
  const resolvedTarget =
    process.env.OPENELIS_PROXY_TARGET ||
    (fs.existsSync("/.dockerenv")
      ? "https://oe.openelis.org:8443"
      : "https://127.0.0.1:8443");

  const common = {
    target: resolvedTarget,
    changeOrigin: true,
    secure: false,
    // Keep redirects on the CRA origin so the browser does not hit CORS on :8443
    autoRewrite: true,
    protocolRewrite: "https",
    cookieDomainRewrite: "",
    headers: {
      // Prefer relative redirects when backend honors it
      "X-Forwarded-Proto": "https",
      "X-Forwarded-Host": "localhost:3000",
    },
  };

  // eslint-disable-next-line no-console
  console.log(`[setupProxy] proxying /OpenELIS-Global -> ${resolvedTarget}`);

  app.use("/OpenELIS-Global", createProxyMiddleware(common));
  app.use("/api", createProxyMiddleware(common));
};
