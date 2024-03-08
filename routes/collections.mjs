import db from "../db/conn.mjs";

export const colllections = {
  all: db.collections(),
  media: db.collection("media"),
  staticAds: db.collection("staticAds"),
  geoTaggedAds: db.collection("geoTaggedAds"),
  players: db.collection("players"),
  players: db.collection("players"),
  planner: db.collection("planner"),
  surverys: db.collection("engagements"),
};
