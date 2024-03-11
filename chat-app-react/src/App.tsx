import Home from "./Views/Home.tsx";
import {Route, Routes} from "react-router-dom";
import './style/App.scss';
import './style/Home.scss'
import {useEffect, useState} from "react";
import {socketConn} from "./Socket/socket.ts";
import LogIn from "./Components/LogIn.tsx";
import {userIF} from "./Interfaces/Interfaces.ts";

const App = () => {
    const [loggedIn, setLoggedIn] = useState(false);
    const [self, setSelf] = useState<userIF | null>(null);
    const [connectedUsers, setConnectedUsers] = useState([]);

    const setUser = (user: userIF) => {
        setSelf(user);
    }

    useEffect(() => {
        socketConn.on("liste_utilisateurs_connectes", (data) => {
            // parse the data
            data = JSON.parse(data);
            // console.log("Connected users: " + JSON.stringify(data));
            setConnectedUsers(data);
        });

        return () => {
            socketConn.off("liste_utilisateurs_connectes");
        }
    }, []);

    useEffect(() => {
        if (loggedIn && !self) setLoggedIn(false);
    }, [loggedIn]);

    return (
        <Routes>
            <Route path={'*'} element=
                {loggedIn ? <Home self={self as userIF} connectedUsers={connectedUsers} setLoggedIn={setLoggedIn}
                                  loggedIn={loggedIn}/> :
                    <LogIn setUser={setUser} setLoggedIn={setLoggedIn}/>}
            />
        </Routes>
    );
}

export default App;