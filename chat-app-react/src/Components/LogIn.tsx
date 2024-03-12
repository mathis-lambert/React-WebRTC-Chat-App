import {socketConn} from "../Socket/socket.ts";
import React, {useEffect, useState} from "react";
import {userIF} from "../Interfaces/Interfaces.ts";
import {useLocation, useNavigate} from "react-router-dom";

interface CallbacksIF {
    setUser: (user: userIF) => void;
    setLoggedIn: (loggedIn: boolean) => void;
}

const LogIn = ({setUser, setLoggedIn}: CallbacksIF) => {
    const [name, setName] = useState("");

    const location = useLocation();
    const navigate = useNavigate();

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

    useEffect(() => {
        if (location.pathname !== "/") {
            navigate("/");
        }
    }, [location]);

    const handleNameFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (name === "") return;
        socketConn.connect();
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