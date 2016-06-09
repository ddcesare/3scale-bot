import Botkit from 'botkit'
import http from 'http'

if (!process.env.providerKey || !process.env.serviceID || !process.env.token) {
  console.log('Error: Specify providerKey serviceID and token in environment');
  process.exit(1);
}

let controller = Botkit.slackbot()
let bot = controller.spawn({
  token: process.env.token
})

bot.startRTM((err, bot, payload) => {
  if (err) {
    throw new Error('Could not connect to Slack');
  }
})

controller.hears(['che'], 'direct_message,direct_mention,mention', (bot, message) => {

  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'robot_face',
  }, function(err, res) {
    if (err) {
      bot.botkit.log('Failed to add emoji reaction :(', err);
    }
  });


  controller.storage.users.get(message.user, function(err, user) {
    if (user && user.name) {
      bot.reply(message, 'Hello ' + user.name + '!!');
    } else {
      bot.reply(message, 'Hello.');
    }
  });
});

controller.hears(['show me the usage of hits'], 'direct_message,direct_mention,mention', function(bot, message) {
  let options = {
    hostname: 'multitenant-admin.3scale.net.dev',
    port: 3000,
    //path: '/stats/services/6/usage.json',
    method: 'GET',
    agent: false,
    path: `/stats/services/${process.env.serviceID}/usage.json?provider_key=${process.env.providerKey}&metric_name=hits&since=2016-05-07&until=2016-05-09&granularity=month&skip_change=true`
    /*query: {
      provider_key: process.env.providerKey,
      metric_name: 'hits',
      since: '2015-05-07',
      until: '2015-05-09',
      granularity: 'day',
      skip_change: true
    }*/
  };

  http.get(options, (res) => {
    /*console.log('statusCode: ', res.statusCode);
    console.log('headers: ', res.headers);*/
    res.setEncoding('utf8');
    res.on('data', (d) => {
      bot.reply(message, JSON.stringify(d))
      //process.stdout.write(d);
      console.log(d)
    });
  })

  .on('error', (e) => {
    console.error(e);
  });
});


