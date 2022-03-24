import express from "express";

const healthRouter = express.Router();

healthRouter.get("/", (req, res) => {
  res.send({ service_name: "Qonto service", health: "OK" });
});

export default healthRouter;
