import {useEffect, useState, useRef} from "react";
import {socketConn} from "../Socket/socket.ts";
import {useLocation} from "react-router-dom";
import {userIF} from "../Interfaces/Interfaces.ts";

interface MessagesListProps {
    connectedUsers: userIF[];
    self: userIF;
}

const MessagesList = ({connectedUsers, self}: MessagesListProps) => {
    const [messages, setMessages] = useState<string[]>([]);
    const messagesRef = useRef<HTMLDivElement>(null);
    const location = useLocation();

    const scrollDown = () => {
        if (messagesRef.current) {
            messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
    }

    useEffect(() => {
        socketConn.on("get_liste_messages", (data) => {
            console.log("Liste de messages: " + data);
            data = JSON.parse(data);
            setMessages(data);
            scrollDown();
        });
    }, [location]);

    useEffect(() => {
        socketConn.on("chat message", (data) => {
            // parse the data
            data = JSON.parse(data);
            console.log("Message: " + JSON.stringify(data));

            console.log(location.pathname.split("/")[2])
            console.log(data.to)
            if (location.pathname.split("/")[2] !== data.to) return;

            const to_user = connectedUsers.find((u) => u.uuid === data.to) || {
                username: "Utilisateur inconnu",
                id: "-1",
                uuid: "-1",
            };
            console.log("To user: " + JSON.stringify(to_user));

            // Add the message to the page
            if (data.id === self.id) {
                console.log(messages);

                setMessages(currentMessages => [...currentMessages, `<div class="message me"><strong>Vous à ${to_user.username}</strong>: ${data.text}</div>`]);
            } else {
                // PushState to the url
                const from = connectedUsers.find((u) => u.id === data.id) || {
                    username: "Utilisateur inconnu",
                    id: "-1",
                    uuid: "-1",
                };

                //window.history.pushState({}, "", `?to=${from.uuid}`);
                console.log("From user: " + JSON.stringify(from));
                console.log(messages);
                setMessages(currentMessages => [...currentMessages, `<div class="message"><strong>De ${data.username}</strong>: ${data.text}</div>`]);
            }

            // scroll to the bottom of the chat
            scrollDown();
        });

        return () => {
            socketConn.off("chat message");
        };
    }, [location]);

    useEffect(() => {
        // // find the user where connected was true but has become false
        // const disconnectedUser = connectedUsers.find((user) => {
        //     return tempConnectedUsers.find((u: userIF) => u.id === user.id && !u.connected && user.connected);
        // });
        //
        // setTempConnectedUsers(connectedUsers);
        //
        // if (disconnectedUser) {
        //     setMessages(currentMessages => [...currentMessages, `<div class="event"><strong>${disconnectedUser.username}</strong> &nbsp;vient de se déconnecter</div>`]);
        // }
    }, [connectedUsers]);

    return (
        <div className={"message-scroller"}>
            <div id="messages" ref={messagesRef}>
                {messages.map((message: string, index: number) => {
                    let sanitizedMessage = message.replace(/<script/g, "&lt;script").replace(/<\/script>/g, "&lt;/script&gt;");
                    sanitizedMessage = sanitizedMessage.replace(/<img/g, "&lt;img").replace(/\/>/g, "/&gt;");
                    sanitizedMessage = sanitizedMessage.replace(/<a/g, "&lt;a").replace(/<\/a>/g, "&lt;/a&gt;");
                    return <div key={index}
                                dangerouslySetInnerHTML={{__html: sanitizedMessage}}/>
                })}
            </div>
        </div>
    )
}

export default MessagesList