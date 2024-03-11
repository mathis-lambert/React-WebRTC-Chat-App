const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const {v4: uuidv4} = require('uuid');

// ### @NOTE ###
// utilisation du package crypto pour générer un uuid unique pour gérer les reconnections
const crypto = require("crypto");
const {json} = require("express");
// /////////////

// Create an array to store connected sockets
let connectedSockets = [];

// rooms
let rooms = {};

const discussions = {}

const calls = {};

let discussion = {
    "uuidv4": {
        "name": "test",
        "creator": {
            "id": "user_id",
            "pseudo": "test"
        },
        "members": [
            {
                "id": "user_id",
                "pseudo": "test"
            },
            {
                "id": "user_id",
                "pseudo": "test"
            }
        ],
        "messages": [],
        "inCall": false,
    }
}

function updateConnectedUsers(data, socket) {
    console.log("Updating connected users for discussion: " + data.discussion + " for user: " + socket.id)
    if (calls[data.discussion]) {
        if (!calls[data.discussion].connected_users.includes(socket.id)) {
            calls[data.discussion].connected_users.push(socket.id);

            calls[data.discussion].members.forEach((m) => {
                console.log("Sending connected users to: " + m + " for discussion: " + data.discussion);
                io.to(m).emit('call_connected_users', {
                    discussion: data.discussion,
                    connected_users: calls[data.discussion].connected_users
                });
            })
        }
    }
}

io.on("connection", (socket) => {
    console.log("New user connected : " + socket.id);

    socket.on("connexion_utilisateur", (username) => {
        console.log("New identity request: " + username);

        if (username === "") {
            console.log("Username is empty");
            return;
        }

        if (connectedSockets.find((s) => s.username === username)) {
            console.log("Username already in use");
            let user = connectedSockets.find((s) => s.username === username);
            user.connected = true;
            user.id = socket.id;
            socket.emit("utilisateur_connecte", JSON.stringify(user));
        } else {
            console.log("Username is available");

            // send back the identity of the user to the client
            let identity = {
                id: socket.id,
                username: username,
                uuid: crypto.randomBytes(32).toString("hex"),
                connected: true
            };
            socket.emit("utilisateur_connecte", JSON.stringify(identity));

            console.log("New identity: " + JSON.stringify(identity));

            // Add the simplified socket object to the connectedSockets array
            connectedSockets.push(identity);
        }

        // Send to all clients the list of connected users
        io.emit("liste_utilisateurs_connectes", JSON.stringify(connectedSockets))
        console.log("Connected users: " + JSON.stringify(connectedSockets));
    });

    socket.on('get_liste_discussions', () => {
        let discussions_list = {};
        for (let key in discussions) {
            if (discussions[key].members.find((m) => m === connectedSockets.find((s) => s.id === socket.id).uuid)) {
                discussions_list[key] = discussions[key];
            }
        }
        console.log("Discussions list: " + JSON.stringify(discussions_list) + " for user: " + socket.id);
        socket.emit("liste_discussions", discussions_list);
    });

    // Relayer les offres, réponses et candidats ICE entre les pairs
    socket.on('send_offer', (data) => {
        try {
            let pseudo_caller = connectedSockets.find((s) => s.id === socket.id)?.username;

            if (socket.id === data.initiator) {
                calls[data.discussion] = {
                    type: data.type,
                    members: data.members,
                    connected_users: [socket.id],
                    initiator: data.initiator,
                };
            } else {
                updateConnectedUsers(data, socket);
            }

            let member = connectedSockets.find((s) => s.id === data.target);
            if (member && member.id && member.connected && member.id !== socket.id) {
                console.log(socket.id + " is sending offer to: " + data.target);
                socket.to(data.target).emit('receive_offer', {
                    discussion: data.discussion,
                    members: data.members,
                    initiator: data.initiator,
                    sender: socket.id,
                    offer: data.offer,
                    pseudo_caller: pseudo_caller,
                    type: data.type,
                    connected_users: calls[data.discussion].connected_users
                });
            }

        } catch (e) {
            console.log("Utilisateur introuvable")
        }

    });

    socket.on('send_answer', (data) => {
        console.log(socket.id + " is sending answer to: " + data.target);
        updateConnectedUsers(data, socket);
        socket.to(data.target).emit('receive_answer', {sender: socket.id, answer: data.answer});
    });

    socket.on('send_ice_candidate', (data) => {
        console.log(socket.id + " is sending candidate to:", data.target);
        socket.to(data.target).emit('receive_ice_candidate', {
            sender: socket.id,
            candidate: data.candidate,
            discussion: data.discussion
        });
    });

    socket.on('get_discussion_info', (data) => {
        console.log("Sending discussion info to: " + socket.id);
        socket.emit('discussion_info', discussions[data]);
    });

    socket.on('offer_rejected', (data) => {
        console.log("Offer rejected by: " + data.target);
        socket.to(data.target).emit('offer_rejected', {
            sender: socket.id,
            target: data.target
        });
    });

    socket.on('hang_up', (data) => {
        console.log("Hang up by: " + data.target);
        delete calls[data.discussion];
        socket.to(data.target).emit('hang_up', {
            sender: socket.id,
            target: data.target
        });
    })

    // receive a message from the client and send it to all clients
    socket.on("chat message", (msg) => {
        msg_parsed = JSON.parse(msg);
        if (msg_parsed.text === "") return;
        let to = msg_parsed.to;

        console.log("Message from: " + JSON.stringify(msg_parsed));

        let to_discussion = discussions[to];
        msg_parsed.date = new Date().toISOString();

        console.log("Message for: " + JSON.stringify(to_discussion));

        if (to_discussion) {
            discussions[to].messages.push(msg_parsed);
            discussions[to].members.forEach((m) => {
                let member = connectedSockets.find((s) => s.uuid === m);
                if (member && member.id && member.connected) {
                    console.log("Emitting to: " + member.id + " for discussion: " + to);
                    io.to(member.id).emit("chat message", msg);
                } else {
                    console.log("Member not found or not connected: " + m);
                }
            });
        } else {
            console.log("Discussion not found: " + to);
        }
    });

    socket.on('nouvelle_discussion', (data) => {
        console.log("Nouvelle discussion: " + JSON.stringify(data))
        let creator = connectedSockets.find((s) => s.id === socket.id && s.connected);

        if (creator) {
            let discussion = {
                name: data.name,
                uuid: uuidv4(),
                creator: creator.uuid,
                members: data.members,
                messages: []
            };

            discussion.members.push(creator.uuid);
            discussions[discussion.uuid] = discussion;
            socket.join(discussion.uuid)

            console.log("Discussion created: " + JSON.stringify(discussion));

            socket.emit("discussion_created", {[discussion.uuid]: discussion});
            discussion.members.forEach((m) => {
                // join the room for each member
                let member = connectedSockets.find((s) => s.uuid === m);
                if (member) {
                    console.log("Emitting to: " + member.id + " for discussion: " + discussion.uuid);
                    io.to(member.id).emit("nouvelle_discussion", {[discussion.uuid]: discussion});
                } else {
                    console.log("Member not found: " + m);
                }
            });

        } else {
            console.log("Someones trying to create a room without being connected")
        }
    });

    socket.once("disconnect", () => {
        console.log("User disconnected for socket id: " + socket.id);

        // set connected to false for the disconnected user
        let disconnectedUser = connectedSockets.find((s) => s.id === socket.id);
        if (disconnectedUser) {
            disconnectedUser.connected = false;
            disconnectedUser.id = null;
        }

        console.log("Connected users: " + JSON.stringify(connectedSockets));

        // Send to all clients the updated list of connected users
        io.emit("liste_utilisateurs_connectes", JSON.stringify(connectedSockets));
    });
});

const port = process.env.PORT || 3001;
http.listen(port, '0.0.0.0', () => {
    let interfaces = require('os').networkInterfaces();
    let addresses = [];

    console.log(`WebRTC App listening on port ${port} on the following addresses:`);
    for (let k in interfaces) {
        for (let k2 in interfaces[k]) {
            let address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                console.log("http://" + address.address + ":" + port);
            }
        }
    }
});
