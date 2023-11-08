import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";

const router = express.Router();
let collection = db.collection("engagements");

router.get("/", async (req, res) => {
  try {
    let query = {
      status: { $not: { $eq: "deleted" } },
    };
    let results = await collection
      .aggregate([
        {
          $lookup: {
            from: "surveyResponses",
            localField: "_id",
            foreignField: "survey_id",
            as: "responses",
          },
        },
        {
          $addFields: {
            responseCount: {
              $size: "$responses",
            },
          },
        },
        {
          $project: {
            responses: 0,
          },
        },
        {
          $match: query,
        },
      ])
      .toArray();
    res.send(results).status(200);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});
router.get("/responses/:id", async (req, res) => {
  let collection = db.collection("surveyResponses");
  try {
    let query = {
      survey_id: { $eq: new ObjectId(req.params.id) },
    };
    let results = await collection
      .find(query)
      .project({
        survey_id: 0,
      })
      .toArray();
    res.send(results).status(200);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

router.post("/", async (req, res) => {
  const data = req.body;

  let result = await collection.insertOne(data);
  res.send(result).status(204);
});

router.patch("/:id", async (req, res) => {
  const query = { _id: new ObjectId(req.params.id) };
  const data = req.body;
  delete data._id;
  const updates = {
    $set: { ...data },
  };
  let result = await collection.updateOne(query, updates);
  res.send(result).status(204);
});

router.delete("/:id", async (req, res) => {
  const query = { _id: new ObjectId(req.params.id) };

  const updates = {
    $set: {
      status: "deleted",
    },
  };
  let result = await collection.updateOne(query, updates);

  res.send(result).status(200);
});
router.post("/app", async (req, res) => {
  let collection = db.collection("surveyResponses");
  const data = req.body;
  const post = {
    survey_id: new ObjectId(data._id),
    response: [...data.data],
  };
  let result = await collection.insertOne(post);
  res.send(result).status(204);
});
export default router;
