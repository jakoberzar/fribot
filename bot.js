// Load up the discord.js library
const Discord = require("discord.js");

const _ = require("lodash");

// This is your client. Some people call it `bot`, some people call it `self`,
// some might call it `cootchie`. Either way, when you see `client.something`, or `bot.something`,
// this is what we're refering to. Your client.
const client = new Discord.Client();

// Here we load the config.json file that contains our token and our prefix values.
const config = require("./config.json");
// config.token contains the bot's token
// config.prefix contains the message prefix.

// Load FRI info
const modulesData = require("./modulesData.json");

const waitingForReply = {};

const friGuildId = config.guildId;

let friGuild = undefined;

client.on("ready", () => {
    // This event will run if the bot starts, and logs in, successfully.
    console.log(`Bot has started, with ${client.users.size} users, in ${client.channels.size} channels of ${client.guilds.size} guilds.`);
    // Example of changing the bot's playing game to something useful. `client.user` is what the
    // docs refer to as the "ClientUser".
    client.user.setActivity(`2nd semester`);

    friGuild = client.guilds.find('id', friGuildId);
});

client.on("guildCreate", guild => {
    // This event triggers when the bot joins a guild.
    console.log(`New guild joined: ${guild.name} (id: ${guild.id}). This guild has ${guild.memberCount} members!`);
    client.user.setActivity(`on ${client.guilds.size} servers`);
});

client.on("guildDelete", guild => {
    // this event triggers when the bot is removed from a guild.
    console.log(`I have been removed from: ${guild.name} (id: ${guild.id})`);
    client.user.setActivity(`on ${client.guilds.size} servers`);
});


client.on("message", async message => {
    // This event will run on every single message received, from any channel or DM.

    // It's good practice to ignore other bots. This also makes your bot ignore itself
    // and not get into a spam loop (we call that "botception").
    if (message.author.bot) return;

    // Also good practice to ignore any message that does not start with our prefix,
    // which is set in the configuration file.
    if (message.channel.type === 'dm' && waitingForReply[message.author.id]) {
        const task = waitingForReply[message.author.id];
        if (message.content.toLowerCase() === 'y' || message.content.toLowerCase() === 'yes') {
            if (task.action === 'join') {
                joinTask(task);
            } else {
                unjoinTask(task);
            }
        }
        delete waitingForReply[message.author.id];
    }
    if (message.content.indexOf(config.prefix) !== 0) return;

    // Here we separate our "command" name, and our "arguments" for the command.
    // e.g. if we have the message "+say Is this the real life?" , we'll get the following:
    // command = say
    // args = ["Is", "this", "the", "real", "life?"]
    const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    // Let's go with a few common example commands! Feel free to delete or change those.

    if (command === "ping") {
        // Calculates ping between sending a message and editing it, giving a nice round-trip latency.
        // The second ping is an average latency between the bot and the websocket server (one-way, not round-trip)
        const m = await message.channel.send("Ping?");
        m.edit(`Pong! Latency is ${m.createdTimestamp - message.createdTimestamp}ms. API Latency is ${Math.round(client.ping)}ms`);
    }

    if (command === "say") {
        // makes the bot say something and delete the message. As an example, it's open to anyone to use.
        // To get the "message" itself we join the `args` back into a string with spaces:
        const sayMessage = args.join(" ");
        // Then we delete the command message (sneaky, right?). The catch just ignores the error with a cute smiley thing.
        message.delete().catch(O_o => { });
        // And we get the bot to say the thing:
        message.channel.send(sayMessage);
    }

    if (command === "kick") {
        // This command must be limited to mods and admins. In this example we just hardcode the role names.
        // Please read on Array.some() to understand this bit:
        // https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Array/some?
        if (!message.member.roles.some(r => ["Administrator", "Moderator"].includes(r.name)))
            return message.reply("Sorry, you don't have permissions to use this!");

        // Let's first check if we have a member and if we can kick them!
        // message.mentions.members is a collection of people that have been mentioned, as GuildMembers.
        let member = message.mentions.members.first();
        if (!member)
            return message.reply("Please mention a valid member of this server");
        if (!member.kickable)
            return message.reply("I cannot kick this user! Do they have a higher role? Do I have kick permissions?");

        // slice(1) removes the first part, which here should be the user mention!
        let reason = args.slice(1).join(' ');
        if (!reason)
            return message.reply("Please indicate a reason for the kick!");

        // Now, time for a swift kick in the nuts!
        await member.kick(reason)
            .catch(error => message.reply(`Sorry ${message.author} I couldn't kick because of : ${error}`));
        message.reply(`${member.user.tag} has been kicked by ${message.author.tag} because: ${reason}`);

    }

    if (command === "ban") {
        // Most of this command is identical to kick, except that here we'll only let admins do it.
        // In the real world mods could ban too, but this is just an example, right? ;)
        if (!message.member.roles.some(r => ["Administrator"].includes(r.name)))
            return message.reply("Sorry, you don't have permissions to use this!");

        let member = message.mentions.members.first();
        if (!member)
            return message.reply("Please mention a valid member of this server");
        if (!member.bannable)
            return message.reply("I cannot ban this user! Do they have a higher role? Do I have ban permissions?");

        let reason = args.slice(1).join(' ');
        if (!reason)
            return message.reply("Please indicate a reason for the ban!");

        await member.ban(reason)
            .catch(error => message.reply(`Sorry ${message.author} I couldn't ban because of : ${error}`));
        message.reply(`${member.user.tag} has been banned by ${message.author.tag} because: ${reason}`);
    }

    if (command === "purge") {
        if (!message.member.roles.some(r => ["Administrator", "Moderator"].includes(r.name)))
            return message.reply("Sorry, you don't have permissions to use this!");

        // This command removes all messages from all users in the channel, up to 100.

        // get the delete count, as an actual number.
        const deleteCount = parseInt(args[0], 10);

        // Ooooh nice, combined conditions. <3
        if (!deleteCount || deleteCount < 2 || deleteCount > 100)
            return message.reply("Please provide a number between 2 and 100 for the number of messages to delete");

        // So we get our messages, and delete them. Simple enough, right?

        const fetched = await message.channel.fetchMessages({ limit: deleteCount });
        message.channel.bulkDelete(fetched)
            .catch(error => message.reply(`Couldn't delete messages because of: ${error}`));
    }

    /**
     * OUR ACTUAL USER COMMANDS
     */
    const modules = getModulesSorted(modulesData);

    if (command === "join" || command === "unjoin") {
        const member = friGuild.members.get(message.author.id);

        let reply = '';

        if (args.length === 0) {
            reply = 'You did not specify enough parameters for the ' + command + ' command!';
        } else if (args[0] === 'help') {
            reply = getHelp(command);
        } else {
            const subjects = applyModulesToSubjects(modulesData);
            // Check if the roles are fine
            const subjectRoles = subjects.map(subject => subject.acronym.toLowerCase());
            const otherRoles = modulesData.otherRoles.map(role => role.acronym.toLowerCase());
            const argsLower = args.map(arg => arg.toLowerCase());

            // Get only the roles that user can apply to
            let appliedRoles = _.intersection(argsLower, _.union(subjectRoles, otherRoles));

            if (command === 'unjoin') {
                // Offer to unjoin only roles that the user already has
                const userRoles = member.roles.map(role => role.name);
                appliedRoles = _.intersection(appliedRoles, userRoles);
            }

            if (appliedRoles.length === 0) {
                // User didn't specify any viable roles <.<
                reply = 'You did not specify any viable roles! Try using the `$ roles-info` command!\n'
                    + 'Your current roles are: ' + member.roles.map(role => role.name).join(', '); + '\n';
            } else {
                // User specified enough roles, now get nicer info on them
                const [ appliedSubjects, appliedOthers ] = _.partition(appliedRoles, role => {
                    return subjectRoles.some(sub => sub == role)
                });

                const appliedSubjectsInfo = appliedSubjects
                    .map(role => {
                        const sub = subjects.find(s => s.acronym.toLowerCase() == role);
                        return `- **${sub.acronym.toLowerCase()}** - ${sub.name} _(${sub.module.name})_`;
                    })
                    .join('\n');

                const appliedOthersInfo = appliedOthers
                    .map(role => {
                        const other = modulesData.otherRoles.find(s => s.acronym.toLowerCase() == role);
                        return `- **${other.acronym}** - ${other.name} - ${other.description}`
                    }).join('\n');

                reply = 'Do you want to ' + command + ':\n\n'
                    + appliedSubjectsInfo + '\n'
                    + appliedOthersInfo + '\n\n'
                    + 'Reply with [y/n].';

                waitingForReply[message.author.id] = {
                    'action': command,
                    'message': message,
                    'data': {
                        roles: appliedRoles
                    },
                    'timestamp': message.createdTimestamp
                }
            }
        }

        sendDirectMessage(message.author, reply);
        deleteMessageTextChannel(message);
    }

    if (command === "roles-info") {
        const subjects = applyModulesToSubjects(modulesData);
        const subjectInfo = subjects.map(subject => {
            return `- **${subject.acronym.toLowerCase()}** - ${subject.name} _(${subject.module.name})_`
        }).join('\n');

        const otherRolesInfo = modulesData.otherRoles.map(role => {
            return `- **${role.acronym}** - ${role.name} - ${role.description}`
        }).join('\n');

        const reply = 'Roles for optional subjects (2nd semester):\n\n'
            + subjectInfo + '\n\n'
            + 'Other possible roles:\n\n'
            + otherRolesInfo + '\n';

        sendDirectMessage(message.author, reply);
        deleteMessageTextChannel(message);
    }

    if (command === "help") {
        const reply = getHelp();
        sendDirectMessage(message.author, reply);
        deleteMessageTextChannel(message);
    }
});

function sendDirectMessage(user, message) {
    user.createDM().then(channel => {
        channel.send(message);
    }).catch(reason => {
        console.log(`Could not create a DM channel with ${user.username}:\n${reason}\nMessage:\n${message}\n`);
    });
}

function deleteMessageTextChannel(message) {
    if (message.channel.type === "text") {
        message.delete().catch(reason => {
            console.log('Could not delete a message:\n' + reason);
        });
    }
}

function getHelp(section) {
    let message = `Here's help for you:`;
    let commandHelp = [
        {
            command: 'join <role1> <role2> ...',
            description: 'Join the specified roles. To get more information on the roles you can join, use the command '
                + '`$ roles-info`',
            example: 'join oim pui bmo zzrs oo',
        },
        {
            command: 'roles-info',
            description: 'Tells you about the roles you can choose between.',
            example: 'roles-info'
        },
        {
            command: 'unjoin <role1> <role2> ...',
            description: 'Unjoin the specified roles. To get more information on the roles you can unjoin, use the command '
                + '`$ roles-info`',
            example: 'unjoin oim pui bmo zzrs oo',
        }
    ]

    if (section === "join") {
        message = `Here's help for you on the join command:`;
        commandHelp = [
            {
                command: 'join <role1> <role2> ...',
                description: 'Join the specified roles. To get more information on the roles you can join, use the command '
                    + '`$ roles-info`',
                example: 'join oim pui bmo zzrs oo',
            }
        ]
    }

    if (section === "unjoin") {
        message = `Here's help for you on the join command:`;
        commandHelp = [
            {
                command: 'unjoin <role1> <role2> ...',
                description: 'Unjoin the specified roles. To get more information on the roles you can unjoin, use the command '
                    + '`$ roles-info`',
                example: 'unjoin oim pui bmo zzrs oo',
            }
        ]
    }

    return message + '\n\n'
        + commandHelp.map(command => {
            return '- `$ ' + command.command + '` - '
                + command.description
                + '\n\t\tExample: _$ ' + command.example + '_\n';
        }).join('');
}

function getModulesSorted(moduleData) {
    return moduleData.modules.sort((a, b) => a.id - b.id);
}

function applyModulesToSubjects(modulesData) {
    const modules = getModulesSorted(modulesData);
    return modulesData.subjects.map(subject => {
        let newSubject = subject;
        newSubject['module'] = modules[subject.moduleId];
        return newSubject;
    });
}

function joinTask({ message, data }) {
    const guildMember = friGuild.members.get(message.author.id);
    const roles = friGuild.roles
        .filter(role => data.roles.some(r => r === role.name))
    guildMember.addRoles(roles).then(msg => {
        console.log('Added roles to user ' + message.author.username + ' - roles: ' + data.roles.join(', '));
        sendDirectMessage(message.author, 'Roles added!');
    })
}

function unjoinTask({ message, data }) {
    const guildMember = friGuild.members.get(message.author.id);
    const roles = friGuild.roles
        .filter(role => data.roles.some(r => r === role.name))
    guildMember.removeRoles(roles).then(msg => {
        console.log('Removed roles from user ' + message.author.username + ' - roles: ' + data.roles.join(', '));
        sendDirectMessage(message.author, 'Roles removed!');
    })
}


client.login(config.token);
