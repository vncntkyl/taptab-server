export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius of the earth in meters
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in meters
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

export function getCount(metrics, key, comp) {
  return metrics
    .filter((item) => item[key] === comp)
    .map((item) => {
      return {
        date_logged: item.date_logged,
        [key]: item[key],
      };
    });
}

export function getPlayerCount(array = []) {
  const uniquePlayers = [...new Set(array.map((obj) => obj.player_id))];

  const players = uniquePlayers.map((player) => ({
    player_id: player,
    passed_by: array.filter((item) => item.player_id === player).length,
  }));

  return players;
}

export const groupedByDays = (array) => {
  const groupedDays = array.reduce((acc, obj) => {
    delete obj.player_id;
    const date = new Date(obj.date_logged);
    acc[date.toLocaleDateString()] = acc[date.toLocaleDateString()] || [];
    acc[date.toLocaleDateString()].push(obj);
    return acc;
  }, {});
};

export const groupByMonths = (array) => {
  return array.reduce((acc, obj) => {
    delete obj.player_id;
    const date = new Date(obj.date_logged);
    const year = date.getFullYear();
    const month = date.toLocaleString("en-US", { month: "long" });
    const key = `${month} ${year}`; // Combine month and year into one key
    acc[key] = acc[key] || [];
    acc[key].push(obj);
    return acc;
  }, {});
};
