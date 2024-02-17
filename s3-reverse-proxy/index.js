const express = require("express");
const httpProxy = require("http-proxy");

const PORT = 8080;
const app = express();

const BASE_PATH = "https://vercel-clone-advit.s3.amazonaws.com/__outputs";

const proxy = httpProxy.createProxy();

app.use((req, res) => {
  const hostname = req.hostname;
  const subdomain = hostname.split(".")[0];

  const resolvesTo = `${BASE_PATH}/${subdomain}`;
  return proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
});

proxy.on("proxyReq", (proxyReq, req, res) => {
  const url = req.url;
  if (url === "/") {
    proxyReq.path += "index.html";
  }
});

app.listen(PORT, () => console.log(`Reverse Proxy Started at PORT... ${PORT}`));
