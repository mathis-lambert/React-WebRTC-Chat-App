import {useEffect, useState} from "react";

interface IncomingCallModalIF {
    modalIncomingCall: boolean;
    caller: string | undefined;
    acceptCall: (accept: boolean) => void;
}

const IncomingCallModal = ({modalIncomingCall, caller, acceptCall}: IncomingCallModalIF) => {
    const [callerName, setCallerName] = useState<string | undefined>(undefined);

    useEffect(() => {
        setCallerName(caller);
    }, [caller]);

    useEffect(() => {
        if (callerName === undefined) {
            setCallerName("Un utilisateur inconnu")
        }
    }, [callerName]);

    return (
        <>
            {modalIncomingCall && (
                <>
                <div id="is-calling">
                    <p>{callerName} vous appelle</p>
                    <div className="actions">
                        <button id="acceptButton" onClick={() => acceptCall(true)}>Accepter</button>
                        <button id="rejectButton" onClick={() => acceptCall(false)}>Rejeter</button>
                    </div>
                </div>
                    <div id="modal-background" onClick={() => acceptCall(false)}></div>
                </>
            )}
        </>
    )
}

export default IncomingCallModal