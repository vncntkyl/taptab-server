import express from "express";
const router = express.Router();
import db from "../db/conn.mjs";
router.get("/", async (req, res) => {
  try {
    let size = [];
    const customOrder = [
      "media_library",
      "static_ads",
      "players",
      "user_engagements",
      "users",
    ];
    const collections = await db.collections();
    for (const collection of collections) {
      let key = collection.collectionName;
      const documents = await collection.countDocuments({
        status: { $not: { $eq: "deleted" } },
      });
      if (key === "media") {
        key = "media_library";
      }
      if (key === "staticAds") {
        key = "static_ads";
      }
      if (key === "surveyResponses") {
        key = "user_engagements";
      }

      if (
        ![
          "planner",
          "playlist",
          "engagements",
          "analytics",
          "geoTaggedAds",
        ].includes(key)
      ) {
        size.push({ [key]: documents });
      }
    }
    size = size.sort(
      (a, b) =>
        customOrder.indexOf(Object.keys(a)[0]) -
        customOrder.indexOf(Object.keys(b)[0])
    );
    size = size.reduce((acc, curr) => {
      const key = Object.keys(curr)[0];
      const value = curr[key];
      acc[key] = value;
      return acc;
    }, {});
    res.send(size).status(200);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

export default router;
