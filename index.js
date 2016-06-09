import Botkit from 'botkit'

if (/*!process.env.providerKey || !process.env.serviceID || */!process.env.token) {
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

controller.hears(['che'], 'direct_message,direct_mention,mention', function(bot, message) {

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


