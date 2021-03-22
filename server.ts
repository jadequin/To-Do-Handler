import * as express from "express";
import * as session from "express-session";
import * as mysql from "mysql";

// Ergänzt/Überlädt den Sessionstore um das Attribut "signInName"
declare module "express-session" {
    interface Session {
        signInName: string;
        sessionKey: string;
    }
}

// Stellt eine Verbindung zum Datenbankserver her
const connection: mysql.Connection = mysql.createConnection({
    database: "online_to_do",
    host: "localhost",
    user: "root"
});

// Öffnet die Verbindung zum Datenbankserver
connection.connect((err) => {
    if (err !== null) {
        console.log("DB-Fehler: " + err);
    }
});

// Erzeugt und startet einen Express-Server
const router: express.Express = express();
router.listen(8080, () => {
    console.log("Server gestartet auf http://localhost:8080");
});

// Bei jedem Request werden vorhandene Nutzdaten von Text in Objekte geparst
router.use(express.json());
router.use(express.urlencoded({extended: false}));

// Bei jedem Request wird, falls noch nicht vorhanden, ein Cookie erstellt
router.use(session({
        cookie: { expires: new Date(Date.now() + (1000 * 60 * 60)) },
        secret: Math.random().toString()
    }));


// Der Ordner ./view/res wird auf die URL /res gemapped
router.use("/res", express.static(__dirname + "/view/res"));

// Gibt auf der URL / die Startseite zurück
router.get("/", (req: express.Request, res: express.Response) => {
    res.sendFile(__dirname + "/view/index.html");
});

// Beschreibt alle Routen und ruft die jeweilige Funktion oder Funktionskette auf
router.post("/signIn", signIn);
router.post("/register", register);
router.post("/signOut", checkLogin, signOut);
router.delete("/delUser", checkLogin, delUser, signOut);
router.post("/task", checkLogin, addTask);
router.delete("/task/:id", checkLogin, delTask);
router.put("/task", checkLogin, updTask);
router.get("/tasks", checkLogin, getTasks);
router.get("/isLoggedIn", checkLogin, isLoggedIn);

// Verwaltet eine Map mit  RandomSessionKey / Username
const userSessions = new Map<string, string>();

// Prüft, ob ein Nutzer registriert ist und speichert ggf. den Nutzernamen im Sessionstore ab
function signIn(req: express.Request, res: express.Response): void {
    const signInName: string = req.body.signInName;
    const signInPass: string = req.body.signInPass;

    query("SELECT name FROM anwender WHERE name = ? AND passwort = ?;", [signInName, signInPass]).then((result: any) => {
        // Setzt das Attribut signInName aus dem Sessionstore auf den ersten Eintrag aus dem der SQL-Reflektion
        if(result.length === 1) {
            const sessionKey: string = Math.random().toString();
            userSessions.set(sessionKey, signInName);

            req.session.signInName = signInName;
            req.session.sessionKey = sessionKey;
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    }).catch(() => {
        // DBS-Fehler
        res.sendStatus(500);
    });
}

// Legt einen neuen Nutzer an
function register(req: express.Request, res: express.Response): void {
    const signInName: string = req.body.signInName;
    const signInPass: string = req.body.signInPass;

    // Als erstes wird überprüft, ob bereits ein Nutzer mit dem entsprechenden Namen angelegt wurde
    query("SELECT * FROM anwender WHERE name = ?;", [signInName]).then((result: any) => {
        // Falls es bereits einen Nutzer mit dem Namen gibt, wird ein Error zurückgesendet
        if(result.length !== 0)
            res.sendStatus(404);
    }).catch(() => {
        // DBS-Fehler
        res.sendStatus(500);
    });

    // Nutzer wird angelegt
    query("INSERT INTO anwender VALUES(?, ?);", [signInName, signInPass]).then((result: any) => {
        res.sendStatus(200);
    }).catch(() => {
        // DBS-Fehler
        res.sendStatus(500);
    });
}

// Löscht den Sessionstore und weist den Client an, das Cookie zu löschen
function signOut(req: express.Request, res: express.Response): void {
    if(!userSessions.delete(req.session.sessionKey)) {
        // User nicht eingeloggt
        res.sendStatus(404);
    }

    req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.sendStatus(200);
    });
}

// Löscht einen Benutzer und all seine Tasks
function delUser(req: express.Request, res: express.Response): void {
    const signInName: string = req.session.signInName;

    query("DELETE FROM task WHERE name = ?;", [signInName]).then((results0: any) => {
        query("DELETE FROM anwender WHERE name = ?;", [signInName]).then((results1: any) => {
            if(results1.length === 1) {
                res.sendStatus(200);
            } else {
                res.sendStatus(404);
            }
        }).catch(() => {
            // DBS-Fehler
            res.sendStatus(500);
        });
    }).catch(() => {
        // DBS-Fehler
        res.sendStatus(500);
    });
}

// Fügt einen neuen Task der Datenbank hinzu
function addTask(req: express.Request, res: express.Response): void {
    const taskName: string = req.body.taskName;
    const taskDate: string = req.body.taskDate;
    const userName: string = userSessions.get(req.session.sessionKey);

    if(userName !== undefined && taskName !== undefined && taskDate !== undefined) {
        query("INSERT INTO task (name, titel, faelligkeit) VALUES (?, ?, ?);", [userName, taskName, taskDate]).then(() => {
            res.sendStatus(200);
        }).catch(() => {
            // DBS-Fehler
            res.sendStatus(500);
        });
    } else {
        res.sendStatus(400);
    }
}

// Löscht einen Task aus der Datenbank
function delTask(req: express.Request, res: express.Response): void {
    const taskId: string = req.params.id;
    const sessionKey: string = req.session.sessionKey;

    // Check, ob der Task zu dem Nutzer gehört
    const signInName: string = userSessions.get(sessionKey);
    query("SELECT * FROM task WHERE id = ? AND name = ?;", [taskId, signInName]).then((results: any) => {
        if(results.length !== 1) {
            // Es gibt keinen Task mit der Kombination aus ID und Benutzernamen
            res.sendStatus(404);
        }
    }).catch(() => {
        // DBS-Fehler
        res.sendStatus(500);
    });



    query("DELETE FROM task WHERE id = ?;", [taskId]).then((results: any) => {
        // Keine anderen Fehler sollten auftreten, da es sich sonst um einen groben Konstruktionsfehler der DB handeln würde
        // Fehler im Muster: results.length ist undefined
        res.sendStatus(200);
    }).catch(() => {
        // DBS-Fehler
        res.sendStatus(500);
    });
}

// Bearbeitet einen Task aus der Datenbank
function updTask(req: express.Request, res: express.Response): void {
    const taskId: string = req.body.taskId;
    const taskName: string = req.body.taskName;
    const taskDate: string = req.body.taskDate;
    const sessionKey: string = req.session.sessionKey;

    // Check, ob der Task zu dem Nutzer gehört
    const signInName: string = userSessions.get(sessionKey);
    query("SELECT * FROM task WHERE id = ? AND name = ?;", [taskId, signInName]).then((results: any) => {
        if(results.length !== 1) {
            // Es gibt keinen Task mit der Kombination aus ID und Benutzernamen
            res.sendStatus(404);
        }
    }).catch(() => {
        // DBS-Fehler
        res.sendStatus(500);
    });


    query("UPDATE task SET titel = ?, faelligkeit = ? WHERE id = ? AND name = ?;", [taskName, taskDate, taskId, signInName]).then((results: any) => {
        // Keine anderen Fehler sollten auftreten, da es sich sonst um einen groben Konstruktionsfehler der DB handeln würde
        res.sendStatus(200);
    }).catch(() => {
        // DBS-Fehler
        res.sendStatus(500);
    });
}

// Gibt alle Tasks eines Anwenders zurück
function getTasks(req: express.Request, res: express.Response): void {
    const userName: string = userSessions.get(req.session.sessionKey);

    query("SELECT id, titel, faelligkeit FROM task WHERE name = ?;", [userName]).then((result: any) => {
        res.json(result);
    }).catch(() => {
        // DBS-Fehler
        res.sendStatus(500);
    });
}

// Eine sog. Middleware-Route prüft, ob der Client angemeldet ist und ruft ggf. die nächste Funktion auf
function checkLogin(req: express.Request, res: express.Response, next: express.NextFunction): void {
    if (req.session.signInName !== undefined && userSessions.has(req.session.sessionKey)) {
        // Ruft die nächste Funktion der Funktionskette
        next();
    } else {
        // Client nicht angemeldet
        res.sendStatus(401);
    }
}

// Kleine Hilfsfunktion, die immer 200 OK zurückgibt
function isLoggedIn(req: express.Request, res: express.Response): void {
    res.sendStatus(200);
}

// Ein eigener Wrapper, um die MySQL-Query als Promise (then/catch Syntax) zu nutzen
function query(sql: string, param: any[] = []): Promise<any> {
    return new Promise<any>((resolve: any, reject: any) => {
        connection.query(sql, param, (err: mysql.MysqlError | null, results: any) => {
            if (err === null) {
                resolve(results);
            } else {
                reject(err);
            }
        });
    });
}
