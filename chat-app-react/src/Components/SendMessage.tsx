import {useState} from "react";
import {userIF} from "../Interfaces/Interfaces.ts";
import {socketConn} from "../Socket/socket.ts";
import {useLocation} from "react-router-dom";
interface SendMessageProps {
    self: userIF;
}

const SendMessage = ({self}: SendMessageProps) => {
    const [message, setMessage] = useState("");
    const location = useLocation();

    const handleSendMessage = () => {
        console.log("Sending message: " + message)
        sendMessage(message);
        setMessage("");
    }

    function sendMessage(messageInput: string) {
        console.log(location.pathname.split("/"));
        if (location.pathname.split("/")[2] === undefined) return;
        if (location.pathname.split("/")[1] !== "discussion") return;
        const content = {
            username: self.username,
            id: self.id,
            text: messageInput,
            to: location.pathname.split("/")[2],
        };
        socketConn.emit("chat message", JSON.stringify(content));
    }

    return (
        <div id="message-form">
            <input id={'message-input'} type="text" value={message} onChange={(e) => setMessage(e.target.value)}
                   onKeyUp={(e) => {
                       if (e.key === "Enter") {
                           handleSendMessage();
                       }
                   }}/>
            <button onClick={handleSendMessage}>Envoyer</button>
        </div>
    )
}

export default SendMessage