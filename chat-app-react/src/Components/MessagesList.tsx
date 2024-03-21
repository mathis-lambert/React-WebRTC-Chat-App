import {useEffect, useRef, useState} from "react";
import {socketConn} from "../Socket/socket.ts";
import {useLocation} from "react-router-dom";
import {DiscussionIF, MessageIF, userIF} from "../Interfaces/Interfaces.ts";

interface MessagesListProps {
    self: userIF;
}

const MessagesList = ({self}: MessagesListProps) => {
    const [messages, setMessages] = useState<MessageIF[]>([]);
    const [discussion, setDiscussion] = useState<DiscussionIF | null>(null);
    const messagesRef = useRef<HTMLDivElement>(null);
    const location = useLocation();

    const scrollDown = () => {
        if (messagesRef.current) {
            console.log("Scrolling down");
            messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        } else {
            console.error("Message ref is null")
        }
    }

    useEffect(() => {
        socketConn.emit("get_discussion_info", {});

        socketConn.on("discussion_info", (data: DiscussionIF) => {
            // console.log("Discussion info: " + JSON.stringify(data));
            if (data) {
                setMessages(data.messages as MessageIF[]);
                setDiscussion(data);
            }
        });

        socketConn.on("chat message", (data) => {
            // parse the data
            data = JSON.parse(data);

            if (location.pathname.split("/")[2] !== data.to) return;

            // Add the message to the page
            setMessages(currentMessages => [...currentMessages, data as MessageIF]);
        });

        return () => {
            socketConn.off("get_liste_messages")
            socketConn.off("discussion_info")
            socketConn.off("chat message");
        }
    }, [location]);

    useEffect(() => {
        scrollDown();
    }, [messages])

    return (
        <div className={"message-scroller"} ref={messagesRef}>
            <div id="messages">
                {discussion && messages.map((message: MessageIF, index: number) => {
                    console.log("Message: " + JSON.stringify(message));
                    return <div key={index} className={'message ' + (message.username === self.username ? "me" : "")}>
                        {discussion?.members.length > 2 && message.username !== self.username &&
                            <strong>{message.username}&nbsp;: </strong>}&nbsp;{message.text}
                    </div>
                })}
            </div>
        </div>
    )
}

export default MessagesList