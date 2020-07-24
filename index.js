const aws = require("aws-sdk");
var DynamoDbObj = new aws.DynamoDB({ apiVersion: "2012-08-10" });
aws.config.update({ region: "us-east-1" });
var ses = new aws.SES();

exports.forgotpasswordResetlambda = function(event, context, callback) {
  let email_Json = JSON.parse(event.Records[0].Sns.Message);
  let messageDataJson = JSON.parse(email_Json.data);

  //Calculating the time to live in milliseconds and then assigning the expiration time
  let time_now = new Date().getTime();
  let ttl = 1000*15*60;
  let expirationTime = (time_now + ttl).toString();

  //Extracting the token from the link via 
  var link = messageDataJson.link;
  var reg_pattern_token = /(?!.*=)(.*)$/;
  var token = link.match(reg_pattern_token)[0].toString();
  console.log("Link: "+link);
  console.log("Token: "+token);
  
  //Creating the arguments for email 
  var email_arguments_lambda = {
    Destination: {
      ToAddresses: [
        messageDataJson.email
      ]
    },
    Message: {
      Body: {
        Text: {
          Charset: "UTF-8",
          Data: "Hello "+messageDataJson.email+"\n Link to change your password is: \n"+messageDataJson.link
        }
      },
      Subject: {
        Charset: "UTF-8",
        Data: "Click the link to change the password"
      }
    },
    Source: "Network_Strcutures_Cloud_Computing@"+process.env.DOMAIN_NAME
  };
  let insert_query = {
    TableName: "csye6225",
    Item: {id: { S: messageDataJson.email },resettoken: { S: token }, ttl: { N: expirationTime }}
  };
  let query_arguments = {
    TableName: 'csye6225',
  Key: {
    'id': {S: messageDataJson.email}
  },
  };

  //Check if the email already exists in the dynamo db, if not then make the entry
  DynamoDbObj.getItem(query_arguments, (err, data) => {
    if(err) {
      console.log(err)
    }
    else{
    let jsonData = JSON.stringify(data)
    let parsedJson = JSON.parse(jsonData);
    if (data.Item == null) {
      DynamoDbObj.putItem(insert_query, (err, data) => {
        if (err) console.log(err);
        else {
          console.log(data);
          var acknowlegement = ses.sendEmail(email_arguments_lambda).promise();
          acknowlegement
            .then(function(data) {
              console.log("Email Sent Successfully");
              console.log(data.MessageId);
            })
            .catch(function(err) {
              console.error(err, err.stack);
            });
        }
      });
    } else {
      let current_time = new Date().getTime();
      let ttl = Number(parsedJson.Item.ttl.N);

      if (current_time > ttl) {
        
        DynamoDbObj.putItem(insert_query, (err, data) => {
        if (err) {
          console.log(err);}
        else {
          var acknowlegement = ses.sendEmail(email_arguments_lambda).promise();
          acknowlegement
            .then(function(data) {
              console.log(data.MessageId);
            })
            .catch(function(err) {
              console.error(err, err.stack);
            });
        }
      });
      }
    }}
  });
};