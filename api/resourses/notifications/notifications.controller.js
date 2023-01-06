const moment = require('moment');
const creditController = require('../credits/credits.controller')
const sendMail = require('../nodemailer/mail')

function insert(content) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const sql = `INSERT INTO notifications (content) VALUES (?)`;
  return query(sql, [content]);
}

// obtiene las notificaciones no leidas
function list(clientID) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const sql = `SELECT * FROM notifications n
                WHERE id NOT IN (SELECT notificationId FROM notifications_read WHERE clientId =?) ORDER BY id DESC`;
  return query(sql, [clientID]);
}

//notificaciones clientes envio de mail
async function NotificacionesClientes() {
  const DiasAtraso = creditController.getList(function (err, result) {
    const dataFilter = result.filter(data => data.status === 1 && data.state === 3).map(item => {
      let mailOptions = {
        from: process.env.MAIL_FROM,
        to: process.env.MAIL_TO.split(' '),
        subject: `Tu cuota de Emprendo presenta ${item.dias} dias de atraso.`,
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
      Su cuenta del credito de emprendo presenta dias de atraso ${item.name} ${item.lastname}. 
    </body>`;
    mailOptions.html = html
    if(item.dias % 5 === 0){
      console.log(mailOptions)
      /* sendMail(mailOptions) */
    }
    })
  });
};
async function NotificacionesClientesCuotas (){
  const util = require('util');
  const query = util.promisify(mysqli.query).bind(mysqli);
  const sql = ``
}

function read(notificationID, clientID) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const sql = `INSERT INTO cayetano.notifications_read
                  (clientId, notificationId)
                  VALUES(?, ?)`;
  return query(sql, [clientID, notificationID]);
}

async function gen() {
  const moment = require("moment");
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const sqlDeudores = `SELECT * FROM (
                        SELECT
                                  u.id
                                , u.name
                                , u.lastname
                                , u.token
                                , u.type
                                , u.paused
                                , u.probability
                                , dd.creditId
                                , dd.deuda
                                , CASE WHEN SUM(dias) THEN SUM(dias) ELSE 0 END dueDays
                                FROM users u
                                LEFT JOIN users_types ut ON u.type = ut.id
                                LEFT JOIN (
                                	SELECT
                                	  c.clientID
                                  , c.id creditId
                                	, ci.period
                                	, (ci.amount + safe
                                		+ (CASE WHEN SUM(p.amount) THEN SUM(p.amount) ELSE 0 END)
                                	  )	- (CASE WHEN ci.payed THEN ci.payed ELSE 0 END) as deuda
                                	, DATEDIFF(now(), ci.period) as dias
                                	FROM punitorios p
                                	RIGHT JOIN credits_items ci ON ci.credit_id = p.credit_id
                                		AND MONTH(p.period) = MONTH(ci.period)
                                		AND YEAR (p.period) = YEAR(ci.period)
                                	INNER JOIN credits c on c.id = ci.credit_id
                                	WHERE 1
                                	AND ci.period < now()
                                	GROUP by ci.credit_id,ci.period order by c.clientID, ci.period
                                ) as dd ON u.id = dd.clientID AND dd.deuda > 0
                                WHERE u.type = 4
                                AND u.status = 1
                                GROUP by u.id
                         ) A WHERE A.dueDays > 90`;
  const deudores = await query(sqlDeudores);
  const loopDeudores = async (_) => {
    for (let index = 0; index < deudores.length; index++) {
      const nombre = deudores[index].name + " " + deudores[index].lastname;
      const diasAtraso = deudores[index].dueDays;
      const credito = deudores[index].creditId;
      const deuda = deudores[index].deuda;
      await insert(
        `EL cliente ${nombre} tiene ${diasAtraso} días de atraso, debe $${deuda}, identificador del crédito ${credito}`
      );
    }
  };
  const sqlInversores = `SELECT
                          	u.name,
                          	u.lastname,
                          	i.amount,
                          	DATE_ADD( DATE(i.ts), INTERVAL (i.period) MONTH ) vence
                          FROM
                          	investments i
                          INNER JOIN users u ON
                          	i.investorID = u.id
                          WHERE
                          	DATE(NOW()) >= DATE_ADD( DATE(i.ts), INTERVAL ( i.period -2 ) MONTH )`;
  const inversiones = await query(sqlInversores);
  const loopInversiones = async (_) => {
    for (let index = 0; index < inversiones.length; index++) {
      const nombre =
        inversiones[index].name + " " + inversiones[index].lastname;
      const vence = moment(inversiones[index].vence).format("DD/MM/YYYY");
      const monto = inversiones[index].amount;
      await insert(
        `La inversión del cliente ${nombre} vence ${vence}, monto $${monto}`
      );
    }
  };

  return Promise.all([loopDeudores(), loopInversiones()]);
}
module.exports = {
  insert,
  list,
  read,
  gen,
  NotificacionesClientes
};
