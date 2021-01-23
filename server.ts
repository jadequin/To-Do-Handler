import * as express from "express";
import * as session from "express-session";
import * as mysql from "mysql";

// Ähnlich einer Klasse als Interface nur weniger komplex
interface IRegistrierteBenutzer {
    name: string;
    passwort: string;
}

// Dummys für bereits registrierte Benutzer
// TODO: Muss initial (bei Serverstart) gefüllt werden, sowie mit einem Eintrag bei Registrierung ergänzt werden
const register: IRegistrierteBenutzer[] = [];

// Ergänzt/Überläd den Sessionstore um das Attribut "signInName"
declare module "express-session" {
    interface Session {
        signInName: string;
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
    if (err !== null) {console.log("DB-Fehler: " + err);}
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
    cookie: {
        expires: new Date(Date.now() + (1000 + 60 * 60)),
    },
    secret: Math.random().toString(),
}));


// Der Ordner ./view/res wird auf die URL /res gemapped
router.use("/res", express.static(__dirname + "/view/res"));

// Gibt auf der URL / die Startseite zurück
router.get("/", (req: express.Request, res: express.Response) => {
    res.sendFile(__dirname + "/view/index.html");
});

// Beschreibt alle Routen und ruft die jeweilige Funktion oder Funktionskette auf
router.post("/signIn", signIn);
router.post("/signOut", signOut);
router.post("/task", checkLogin, addTask);
router.delete("/task/:id", checkLogin, delTask);
router.get("/tasks", checkLogin, getTasks);
router.get("/isLoggedIn", checkLogin, isLoggedIn);

// Prüft, ob ein Nutzer registriert ist und speichert ggf. den Nutzernamen im Sessionstore ab
function signIn(req: express.Request, res: express.Response): void {
    const signInName: string = req.body.signInName;
    const signInPass: string = req.body.signInPass;

    const benutzer: IRegistrierteBenutzer = getUser([req.body.loginName, req.body.loginPasswort]);
}

// Löscht den Sessionstore und weist den Client an, das Cookie zu löschen
function signOut(req: express.Request, res: express.Response): void {
}

// Fügt einen neuen Task der Datenbank hinzu
function addTask(req: express.Request, res: express.Response): void {
    const taskName: string = req.body.taskName;
    const taskDate: string = req.body.taskDate;

}

// Löscht einen Task aus der Datenbank
function delTask(req: express.Request, res: express.Response): void {
    const id: string = req.params.id;

}

// Gibt alle Tasks eines Anwenders zurück
function getTasks(req: express.Request, res: express.Response): void {
    query("SELECT id, titel, faelligkeit FROM tasks WHERE name = ?;", [req.session.signInName]).then((result: any) => {
        res.json(result);
    }).catch(() => {
        // DBS-Fehler
        res.sendStatus(500);
    });
}

// Eine sog. Middleware-Route prüft, ob der Client angemeldet ist und ruft ggf. die nächste Funktion auf
function checkLogin(req: express.Request, res: express.Response, next: express.NextFunction): void {
    if (req.session.signInName !== undefined) {
        // Ruft die nächste Funktion der Funktioskette
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
