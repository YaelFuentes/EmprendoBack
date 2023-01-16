const sendMail = require("../nodemailer/mail");
const usersTypeController = require('../users/users.controller');

function getMediaByCredit(creditid, callback) {
  let sql = `SELECT * FROM files WHERE credit_id = ? AND deleted_at IS NULL`;
  mysqli.query(sql, [creditid], (err, rows) => {
    //si queremos imprimir el mensaje ponemos err.sqlMessage
    var response = [];
    if (rows) {
      response = rows;
    }
    return callback(err, response);
  });
}

function deleteMedia(id, callback) {
  let sql = `UPDATE files SET deleted_at = NOW() WHERE id = ? `;
  mysqli.query(sql, [id], (err, rows) => {
    //si queremos imprimir el mensaje ponemos err.sqlMessage
    var response = [];
    if (rows) {
      response = rows;
    }
    return callback(err, response);
  });
}

const emailJuicio = async (type) => {
  const result = await usersTypeController.usersType(type)
  if (Array.isArray(result) && result.length > 0) {
    const returnValue = result.map(item => item.email)
    return returnValue
  }
  return []
}

async function addFileToDb(file, s3Response, creditid, juicio, callback) {
  try {
    const util = require('util');
    const query = util.promisify(mysqli.query).bind(mysqli);
    let originalname = file.originalname;
    let path = file.filename;
    let url = s3Response.Location;
    const sendMailFunction8 = await emailJuicio(8);
    let getSql = `SELECT * FROM credits A INNER JOIN users B ON A.clientID = B.id WHERE A.id = ?;`;
    const getDate = await query(getSql, [creditid], async(err, rows) => {
      
      let response = [];
      if (rows) {
        response = rows;
      }
      let mailOptions = {
        from: process.env.MAIL_FROM,
        to: sendMailFunction8,
        subject: `Actualizacion del credito de: ${response[0].lastname} ${response[0].name}`,
        html: ''
      }
      html = `
      <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Document</title>
    </head>
    <body>
      <p>
        Se han realizado modificaciones en el credito del cliente ${response[0].lastname} ${response[0].name} con DNI nro : ${response[0].dni}.
      </p>
    </body>`;
      mailOptions.html = html
      if (Number(juicio) === 1) {
         sendMail(mailOptions); 
      }
      let sql = `INSERT INTO files (originalname,path,url,credit_id) VALUES (concat('Juicio : ' ?),?,?,?) `;
      if (juicio === 1) {
        let updateSql = `UPDATE credits SET updated_at = NOW() WHERE id = ?;`;
        const updateDateArchive = await query(updateSql, [creditid])
      }
      const insertDateArchive = await query(sql, [originalname, path, url, creditid], (err, rows) => {
        var response = [];
        if (rows) {
          response = rows;
        }
      });
    });

  } catch (error) {
    console.log(error);
  }
}

module.exports = {
  getMediaByCredit,
  addFileToDb,
  deleteMedia,
};
