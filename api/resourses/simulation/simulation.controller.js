
const getSimulation = (userId) => {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  try {
    const response = query ("select * from cayetano.simulation where user_id = ? ",[userId])
    return response
  } catch (error) {
    return error
  }
}
module.exports = {
  getSimulation
}
 