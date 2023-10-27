import express from "express";
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const body = req.body;
    let results = {};
    res.send(results).status(200);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

export default router;
