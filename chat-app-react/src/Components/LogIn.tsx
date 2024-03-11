import {socketConn} from "../Socket/socket.ts";
import React, {useEffect, useState} from "react";
import {userIF} from "../Interfaces/Interfaces.ts";

interface CallbacksIF {
    setUser: (user: userIF) => void;
    setLoggedIn: (loggedIn: boolean) => void;
}

const LogIn = ({setUser, setLoggedIn}: CallbacksIF) => {
    const [name, setName] = useState("");

    useEffect(() => {
        socketConn.on("utilisateur_connecte", (data) => {
            // parse the data
            data = JSON.parse(data);
            window.history.pushState({}, "", `/`);
            setLoggedIn(true);
            setUser(data);
        });

        return () => {
            socketConn.off("utilisateur_connecte");
        };
    }, []);


    const handleNameFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (name === "") return;

        socketConn.emit("connexion_utilisateur", name);
    }


    return (
        <div className="before-chat">
            <div className="form-container">
                <h2>Entrez votre nom</h2>
                <form id="name-form" onSubmit={handleNameFormSubmit}>
                    <input id="name-input" placeholder="Votre prénom..." type="text"
                           onChange={(e) => setName(e.target.value)} value={name}/>
                    <button type="submit">Rejoindre</button>
                </form>
            </div>
        </div>
    )
}

export default LogIn