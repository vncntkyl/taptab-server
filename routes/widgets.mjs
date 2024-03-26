import express from "express";
const router = express.Router();
import db from "../db/conn.mjs";

//retrieve the summary of items in the content manager
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


//truncate the system
router.delete("/", async (req, res) => {
  try {
    const collections = await db.listCollections().toArray();

    const collectionsToTruncate = collections
      .filter((collection) => collection.name !== "users")
      .map((collection) => collection.name);

    if (collectionsToTruncate.length === 0) {
      console.log("No collections to truncate (except users)");
      res.status(200).send("No collections to truncate (except users)");
      return;
    }

    const promises = collectionsToTruncate.map((collectionName) =>
      db.collection(collectionName).deleteMany({})
    );

    Promise.all(promises)
      .then((results) => {
        results.forEach((result, index) => {
          console.log(
            `Truncated ${collectionsToTruncate[index]}: ${result.deletedCount} documents deleted`
          );
        });
        res.status(200).send("Collections truncated successfully");
      })
      .catch((error) => {
        console.error("Error truncating collections:", error);
        res.status(500).send("Error truncating collections: ", error);
      });
  } catch (error) {
    console.error("Error listing collections:", error);
    res.status(500).send("Error listing collections: ", error);
  }
});

export default router;
