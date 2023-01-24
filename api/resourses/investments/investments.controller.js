const usersController = require("../users/users.controller");
const resumeController = require("../resume/resume.controller");
const moment = require("moment");
const sendMail = require("../nodemailer/mail");
const usersTypeController = require("../users/users.controller")
const emailJuicio = async (type) => {
  const result = await usersTypeController.usersType(type)
  if (Array.isArray(result) && result.length > 0) {
    const returnValue = result.map(item => item.email)
    return returnValue
  }
  return []
}

function createInvestment(investment, USER_ID, account_id, caja_id, firstQuote) {
  let sqlState = `INSERT INTO investments (investorID, amount, percentage, termID, period,ts,recapitalizar,recapitalizacion_status,firstQuote,firstPay) 
  VALUES(?, ?, ?, ?, ?,now(),?,?,?,?);`;
  let dataRecap = investment.tipoInversion == true ? "1" : " 0"
  let dataRecapStatus = investment.tipoInversion == true ? "1" : "0"
  const promises = [];
  return new Promise((resolve, reject) => {
    mysqli.query(
      sqlState, [
      investment.investorID,
      investment.amount,
      investment.percentage,
      investment.termID,
      investment.period,
      dataRecap,
      dataRecapStatus,
      firstQuote,
      investment.primera_cuota
    ],
      (err, results, rows) => {
        if (investment.tipoInversion) {
          let recapitalizacionArray = []
          if (firstQuote >= 0) {
            const newFirstAmount = Number(investment.amount) + firstQuote
            for (let i = 0; i < investment.period; i++) {
              if (recapitalizacionArray.length == 0) {
                const new_amount = +newFirstAmount * (1 + +investment.percentage / 100);
                recapitalizacion = {
                  investmentid: results.insertId,
                  prev_amount: newFirstAmount,
                  new_amount: new_amount,
                  USER_ID: USER_ID,
                };
              } else {
                const new_amount = recapitalizacionArray[recapitalizacionArray.length - 1].new_amount * (1 + +investment.percentage / 100);
                recapitalizacion = {
                  investmentid: results.insertId,
                  prev_amount: recapitalizacionArray[recapitalizacionArray.length - 1].new_amount,
                  new_amount: new_amount,
                  USER_ID: USER_ID,
                };
              }
              recapitalizacionArray.push(
                recapitalizacion
              )
            }
          }
          const promises = recapitalizacionArray.map(tipoRecapitalizacion => recapitalizar(tipoRecapitalizacion))
          Promise.all(promises)
        }
        if (err) {
          console.error(err);
          reject({ response: "Error al insertar inversión" });
        } else {
          mysqli.query(
            "SELECT * FROM investments WHERE id = ?",
            [results.insertId],
            (err, rows) => {
              // INSERTAMOS EL INGRESO DE DINERO A LA CAJA TYPE=1 PARA INGRESOS, TYPE=2 PARA EGRESOS
              mysqli.query(
                "INSERT INTO cash_flow (type,amount,created_at,description,user,investment_id,operation_type,account_id,caja_id) VALUES (1,?,?,'ingreso de dinero por nueva inversion',?,?,'inversion_nueva',?,?)",
                [investment.amount, investment.ts, USER_ID, results.insertId, account_id, caja_id],
                (err2, rows2) => {
                  resolve(rows[0]);
                }
              );
            }
          );
        }
      }
    );
  });
}

async function getAllInvestements() {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);

  const sql = `SELECT 
  T1.id,
  T1.investorID,
  T1.amount monto_inversion,
  T1.percentage porcentaje,
  T1.period cuotas,
  T1.firstPay primeraCuota,
  T1.ts fecha_inversion,
  T1.recapitalizar recapitaliza_automaticamente,
  T1.recapitalizacion_status recapitaliza,
  T2.name nombre,
  T2.lastname apellido,
  T2.email,
  T2.dni,
  T2.phone telefono,
  A.periodoMax
  FROM 
  cayetano.investments T1
  INNER JOIN cayetano.users T2 ON T1.investorID = T2.id
  left join (SELECT *,MAX(period) periodoMax FROM cayetano.investments_payments group by investmentID) A on T1.id = A.investmentID
  GROUP BY T1.id 
  `;
  const investments = await query(sql, []);
  let dataMap = investments.map((item) => {
    let proximaCuota;
    const fechaPrimeraCuota = item.primera_cuota ?? item.fecha_inversion;
    if (item.recapitaliza === 1) {
      if (item.cuotas > item.periodoMax) {
        proximaCuota = moment(fechaPrimeraCuota).add(item.cuotas, 'M').format('DD-MM-YYYY');
      }
    } else {
      if (item.periodoMax == null) {
        proximaCuota = moment(fechaPrimeraCuota).format('DD-MM-YYYY');
      } else if (item.cuotas > item.periodoMax) {
        proximaCuota = moment(fechaPrimeraCuota).add(item.periodoMax, 'M').format('DD-MM-YYYY');
      }
    }
    const addDate = moment(item.fecha_inversion).add(item.cuotas, "M").format("DD-MM-YYYY")
    const dateNow = moment().format("DD-MM-YYYY")

    return { ...item, addDate: addDate, proximaCuota: proximaCuota, dateNow: dateNow }
  })
  let activeInvestments = dataMap.filter(activeInvestment => activeInvestment.proximaCuota != null)
  let finishedInvestments = dataMap.filter(activeInvestment => activeInvestment.proximaCuota == null)
  activeInvestments = activeInvestments.sort((A, B) => moment(A.proximaCuota, 'DD-MM-YYYY') - moment(B.proximaCuota, 'DD-MM-YYYY'));
  return [...activeInvestments, ...finishedInvestments]
}


async function getInvestementInfo(investmentId) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);

  const sql = `SELECT * FROM investments WHERE id = ?`;
  const investment = await query(sql, [investmentId]);

  let withdrawAmmount,
    investment_amount = 0;
  let investmentPayments = [];

  if (investment) {
    investment_amount = investment[0].amount;
    const sql2 = `SELECT SUM(amount) withdrawAmmount FROM cayetano.cash_flow WHERE investment_id = ? AND type = 2 AND operation_type = 'retiro_inversion';`;
    const retirosInversion = await query(sql2, [investmentId]);
    if (retirosInversion) {
      withdrawAmmount = retirosInversion[0].withdrawAmmount;
    }

    const investmentPaymentsSql = `SELECT * FROM investments_payments WHERE investmentID = ?`;
    const investmentPayments = await query(investmentPaymentsSql, [
      investmentId,
    ]);

    let pagosRealizados = 0;

    const investmentPaymentsTotalSql = `SELECT SUM(amount) pagosRealizados FROM investments_payments WHERE investmentID = ?`;
    const investmentPaymentsTotal = await query(investmentPaymentsTotalSql, [
      investmentId,
    ]);
    if (investmentPaymentsTotal && investmentPaymentsTotal.length > 0) {
      pagosRealizados = investmentPaymentsTotal[0].pagosRealizados;
    }

    return {
      investment: investment[0],
      amount: investment_amount,
      withdrawAmmount: withdrawAmmount,
      payments: investmentPayments,
      totalPayments: pagosRealizados,
    };
  }
}

async function getRetiros(investment_id) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);

  let retirosTotal = 0;
  let saldo = 0;

  const sql1 = `SELECT amount FROM cayetano.investments WHERE id = ?;`;
  const montoInversionResult = await query(sql1, [investment_id]);

  const sql2 = `SELECT * FROM cash_flow WHERE investment_id = ? AND operation_type = 'retiro_inversion';`;
  const retirosInversionResult = await query(sql2, [investment_id]);

  const sql3 = `SELECT ABS(SUM(amount)) retirosTotal FROM cash_flow WHERE investment_id = ? AND operation_type = 'retiro_inversion';`;
  const retirosTotalResult = await query(sql3, [investment_id]);

  if (retirosTotalResult.length > 0) {
    retirosTotal = retirosTotalResult[0].retirosTotal;
  }

  if (montoInversionResult.length > 0) {
    saldo = montoInversionResult[0].amount - retirosTotal;
  }

  return {
    retiros: retirosInversionResult,
    retirosTotal: retirosTotal,
    saldo: saldo,
  };
}

function getPaymentsByInvestment(investmentId) {
  return new Promise((resolve, reject) => {
    mysqli.query(
      `SELECT * FROM investments_payments WHERE investmentID = ?;`,
      [investmentId],
      (err, rows) => {
        if (err) {
          console.error(err);
          reject({ response: "Error al leer los pagos de la inversion" });
        } else {
          resolve(rows);
        }
      }
    );
  });
}

function getRecapitalizaciones(investmentId) {
  return new Promise((resolve, reject) => {
    mysqli.query(
      `SELECT * FROM recapitalizaciones WHERE investment_id = ?;`,
      [investmentId],
      (err, rows) => {
        if (err) {
          console.error(err);
          reject({
            response: "Error al leer las recapitalizaciones de la inversion",
          });
        } else {
          resolve(rows);
        }
      }
    );
  });
}

function recapitalizar({ investmentid, prev_amount, new_amount, USER_ID }) {
  return new Promise((resolve, reject) => {
    mysqli.query(
      `INSERT INTO recapitalizaciones (investment_id,previous_amount,new_amount,user_id,created_at) VALUES (?,?,?,?,NOW());`,
      [investmentid, prev_amount, new_amount, USER_ID],
      (err, rows) => {
        if (err) {
          console.error(err);
          reject({ response: "Error al insertar recapitalizacion" });
        } else {
          mysqli.query(
            `UPDATE investments SET amount = ? WHERE id = ?;`,
            [new_amount, investmentid],
            (err2, rows2) => {
              if (err2) {
                console.error(err);
                reject({ response: "Error al actualizar valor" });
              } else {
                resolve(rows);
              }
            }
          );
        }
      }
    );
  });
}

function recapitalizar_auto({ investmentId, status, USER_ID }) {
  return new Promise((resolve, reject) => {
    mysqli.query(
      `UPDATE investments SET recapitalizar = ? WHERE id = ?;`,
      [!!status, investmentId],
      (err, rows) => {
        if (err) {
          console.error(err);
          reject({
            response: "Error al actualizar recapitalizacion automatica",
          });
        } else {
          resolve(rows);
        }
      }
    );
  });
}

function recapitalizar_status({ investmentId, status, USER_ID }) {
  return new Promise((resolve, reject) => {
    mysqli.query(
      `UPDATE investments SET recapitalizacion_status = ? WHERE id = ?;`,
      [!!status, investmentId],
      (err, rows) => {
        if (err) {
          console.error(err);
          reject({
            response: "Error al actualizar el estado de la recapitalizacion",
          });
        } else {
          resolve(rows);
        }
      }
    );
  });
}

function payInvestment(investment, USER_ID, account_id, caja_id) {
  return new Promise((resolve, reject) => {
    //ACA CHEQUEAMOS SI SE HA HECHO UNA RECAPITALIZACION, SI ES ASI NO DEBERIA PODER RECIBIR PAGOS
    mysqli.query(
      `SELECT * FROM cayetano.recapitalizaciones WHERE investment_id = ?`,
      [investment.investmentID],
      (errcheck, rowscheck) => {
        let tieneRecapitalizaciones = 0;
        if (rowscheck.length > 0) {
          tieneRecapitalizaciones = 1;
        }
        if (tieneRecapitalizaciones == 0) {
          mysqli.query(
            "SELECT * FROM investments_payments WHERE investmentID = ? ORDER BY period DESC LIMIT 1",
            [investment.investmentID],
            (err, rows) => {
              let lastperiod = 1;
              if (rows.length > 0) {
                lastperiod = +rows[0].period + 1;
              }

              mysqli.query(
                "INSERT INTO investments_payments (investmentID, amount, period) VALUES(?, ?, ?)",
                [investment.investmentID, investment.amount, lastperiod],
                (err, results, rows) => {
                  if (err) {
                    console.error(err);
                    reject({ response: "Error al insertar el pago" });
                  } else {
                    //INSERTAMOS EL EGRESO EN LA CAJA
                    mysqli.query(
                      "INSERT INTO cash_flow (type,amount,created_at,description,user,investment_id,operation_type,account_id,caja_id) VALUES (2,?,NOW(),'egreso de dinero por pago de inversion',?,?,'pago_inversion',?,?);",
                      [
                        investment.amount - investment.amount * 2,
                        USER_ID,
                        investment.investmentID,
                        account_id,
                        caja_id
                      ],
                      (err, results, rows) => {
                        notificationInvestment()
                        mysqli.query(
                          "SELECT * FROM investments_payments WHERE id = ?",
                          [results.insertId],
                          (err, rows) => {
                            resolve(rows[0]);
                          }
                        );
                      }
                    );
                  }
                }
              );
            }
          );
        } else {
          reject({
            response:
              "No puede cargar pagos sobre inversiones con recapitalizaciones",
          });
        }
      }
    );
  });
}
async function getInfoInvestmentUsers(investmentID) {
  const util = require('util');
  const query = util.promisify(mysqli.query).bind(mysqli);
  const sql = `SELECT * FROM cayetano.investments A LEFT JOIN cayetano.users B ON A.investorID = B.id WHERE A.id = ?;`;
  const result = await query(sql, [investmentID]);
  return result
}

async function getInvestmentsByInvestor(investorID) {
  const util = require("util");
  const query = util.promisify(mysqli.query).bind(mysqli);
  const user = await usersController.getUser(investorID);
  const investmentsQuery = `SELECT
	T1.*,
	T2.name tasa
FROM
	investments T1 LEFT JOIN commisions T2 ON T1.termID = T2.id 
WHERE
	T1.investorID = ? ORDER BY T1.ts DESC`;
  const investments = await query(investmentsQuery, [investorID]);
  const investmentsListQuery = `SELECT * FROM  investments i WHERE  i.investorID = ? AND 
  DATE(NOW()) BETWEEN DATE_ADD(DATE(i.ts),INTERVAL (period - 1) MONTH) AND DATE_ADD(DATE(i.ts),INTERVAL (period) MONTH)
	`;
  const investmentsList = await query(investmentsListQuery, [investorID]);

  const compromiso30dias =
    await resumeController.getCommitment30DaysPerInvestments(investmentsList);

  const soloInteresesApagarEn30diasQuery = await query(
    `SELECT 
  *
FROM
  cayetano.investments
WHERE
  DATE_ADD(DATE(ts),INTERVAL (period) MONTH) > DATE(NOW())
AND DATE_ADD(DATE(ts),INTERVAL (period - 1) MONTH) > DATE(NOW())
      AND investorID = ?;`,
    [investorID]
  );

  // se le pasa true a la funcion para que traiga solamente intereses
  const soloInteresesApagarEn30dias =
    await resumeController.getCommitment30DaysPerInvestments(
      soloInteresesApagarEn30diasQuery,
      true
    );

  const paymentsQuery = `SELECT * FROM investments_payments where investmentID =?`;
  // por cada investment me traigo los pagos
  const loopInvestments = async (_) => {
    for (let index = 0; index < investments.length; index++) {
      const payments = await query(paymentsQuery, [investments[index].id]);
      investments[index]["payments"] = payments;
    }
  };
  await loopInvestments();
  return {
    user: user,
    investments: investments,
    compromiso30dias: compromiso30dias,
    soloInteresesApagarEn30dias,
  };
}

const emailInvPago = async (type) => {
  const result = await usersTypeController.usersType(type)
  if (Array.isArray(result) && result.length > 0) {
    const returnValue = result.map(item => item.email)
    return returnValue
  }
  return []
}

async function notificationInvestment(amount, percentaje) {
  const dataInfo = await getAllInvestements()
  console.log(dataInfo)
  const util = require('util');
  const query = util.promisify(mysqli.query).bind(mysqli)
  const sendMailFunction1 = await emailInvPago(1)
  const sendMailFunction5 = await emailInvPago(5)
  const sendMailFunction7 = await emailInvPago(7)
  dataInfo.map((item) => {
    let mailOptions = {
      from: process.env.MAIL_FROM,
      to: sendMailFunction5,
      subject: 'Notificación de pago de intereses',
      html: ''
    }
    html1 = `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document</title>
      </head>
      <body>
      <tbody>
    Estimado ${item.nombre} ${item.apellido} le notificamos desde Em.prendo que en 5 días podrá cobrar el pago del interes del ${item.porcentaje} % mensual de su inversión. Ante cualquier duda o consulta, por favor, comunicarse con Em.prendo
      </tbody>
      </body>`;
    mailOptions.html = html1;
    if (moment().add(5, 'days').format("DD-MM-YYYY") === item.proximaCuota) {
      /* sendMail(mailOptions); */
      console.log(mailOptions)
    }
    let mailOptions2 = {
      from: process.env.MAIL_FROM,
      to: [...sendMailFunction1, ...sendMailFunction7 ],
      subject: 'Aviso de pago a Em.prendo',
      html: ''
    }
    html2 = `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Document</title>
        </head>
        <body>
        <tbody>
      Se informa que la inversión de ${item.nombre} ${item.apellido} por el monto de ${item.monto_inversion} con interes del ${item.porcentaje} % mensual de su inversión debe ser abonada en 5 días
        </tbody>
        </body>`;
    mailOptions2.html = html2;
    if (moment().add(5, 'days').format("DD-MM-YYYY") === item.proximaCuota) {
      /* sendMail(mailOptions); */
      console.log(mailOptions2)
    }
    let mailOptions3 = {
      from: process.env.MAIL_FROM,
      to: sendMailFunction1,
      subject: 'Aviso de finalización de inversión',
      html: ''
    }
    html3 = `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Document</title>
        </head>
        <body>
        <tbody>
      Se informa que la inversión de ${item.nombre} ${item.apellido} por el monto inicial de ${item.monto_inversion} finaliza en 30 días
        </tbody>
        </body>`;
    mailOptions3.html = html3;
    if (moment().add(30, 'days').format("DD-MM-YYYY") === item.addDate) {
      /* sendMail(mailOptions); */
      console.log(mailOptions3)
    }
    let mailOptions4 = {
      from: process.env.MAIL_FROM,
      to: [...sendMailFunction1, ...sendMailFunction7 ],
      subject: 'Aviso de finalización de inversión',
      html: ''
    }
    html4 = `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Document</title>
        </head>
        <body>
        <tbody>
        ${item.nombre} ${item.apellido} se informa que su inversión realizada por el monto inicial de ${item.monto_inversion} en Em.prendo finaliza en 30 días. Pasados los 30 días usted podrá comunicarse con nosotros para retirar su inversión. Ante cualquier duda o consulta, por favor, comunicarse con Em.prendo
        </tbody>
        </body>`;
    mailOptions4.html = html4;
    if (moment().add(30, 'days').format("DD-MM-YYYY") === item.addDate) {
      /* sendMail(mailOptions); */
      console.log(mailOptions4)
    }
  })

}

module.exports = {
  createInvestment,
  recapitalizar_auto,
  recapitalizar_status,
  getInvestmentsByInvestor,
  payInvestment,
  getInvestementInfo,
  getRetiros,
  getPaymentsByInvestment,
  recapitalizar,
  getRecapitalizaciones,
  getAllInvestements,
  getInfoInvestmentUsers,
  notificationInvestment
};
