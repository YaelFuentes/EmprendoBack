/* const { query } = require('express');

async function getUsers() {
  const state4 = await usersTypeState4();

  return {
    state4
  };
}

async function usersTypeState4() {
  const util = require("util")
  const query = util.promisify(mysqli.query).bind(mysqli);
  const dataQuery = `select B.name,B.lastname,A.status,A.clientID,A.carID,A.state usersState4 from cayetano.credits A join cayetano.users B on A.clientID = B.id and A.state = '4' and B.status = '1';
  `;
  const result = await query(dataQuery, []);
  if(result){
    return result[0].usersState4
  }
}

module.exports = {
  getUsers
} */