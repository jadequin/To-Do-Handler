# To-Do-Handler
Eine Anwendung mit angebundener Datenbank zur Verwaltung von Nutzern und deren Tasks.

## checkLogin und seine Funktionsweise
Die `checkLogin()` Funktion überprüft, ob der gesendete `signInName` nicht undefined ist *und* ob der `sessionKey` in der Map `userSessions` enthalten ist.
Falls der Check erfolgreich ist, wird die nächste Funktion aus der Kette aufgerufen, ansonsten gibt es einen Fehlercode.

## Routen
Die Routen starten beim Client (script.ts) mit einer Request an den Server (server.ts). Dort wird ausgewählt, um welche der CRUD Komponenten es sich handelt. Außerdem können gegebenenfalls Daten mitgesendet werden. Diese werden entweder an die URL angehängt oder in ein JSON-Objekt verpackt und versendet.

``` typescript
// Daten in der URL
axios.delete("/task/" + id);

// Daten als JSON-Objekt
axios.post("/register", {
        signInName: formData.get("registerName"),
        signInPass: formData.get("registerPass")
});
```

### signIn
Mit dieser Route kann sich ein User einloggen.

``` typescript
//Funktionskette
router.post("/signIn", signIn);
```

Payload im Request-Body: 
- `signInName`
- `signInPass`

Die Funktion löst direkt eine Datenbankanfrage aus: 

`SELECT name FROM anwender WHERE name = signInName AND passwort = signInPass;`

Wenn *genau* ein Ergebnis aus der Anfrage entsteht, dann wird eine neue Session generiert und in die userSession-Map aufgenommen.
In der Map wird dabei ein zufällig generierter SessionKey als Key mit dem zugehörigen Benutzernamen als Value abgespeichert.
Danach wird noch der `signInName` und der `sessionKey` aus dem Sessionstore auf die entsprechenden Werte gesetzt.

### register
Mit dieser Route kann sich ein User erstmalig registrieren. Der Benutzername muss einmalig sein.

``` typescript
//Funktionskette
router.post("/register", register);
```

Payload im Request-Body:
- `signInName`
- `signInPass`

Die Funktion stößt zuerst folgende Datenbankanfrage an: 

`SELECT * FROM anwender WHERE name = signInName;`

Diese überprüft, ob bereits ein Nutzer mit dem Benutzernamen existiert und gibt einen Fehlercode zurück, falls dies zutrifft.
Sollte das geklappt haben, wird eine zweite DB-Anfrage ausgelöst: 

`INSERT INTO anwender VALUES(signInName, signInPass);`

Damit wird schließlich der Benutzer in die Datenbank eingetragen.

### signOut
Mit dieser Route wird ein User ausgeloggt, sofern er gerade eine aktive und gültige Session offen hat.

``` typescript
//Funktionskette
router.post("/signOut", checkLogin, signOut);
```

Kein Payload, es wird nur der `sessionKey` aus dem Sessionstore benötigt

In der Funktion wird zuerst versucht, den mitgesendeten SessionKey aus der Map `userSessions` zu löschen.
Falls das nicht klappt, wird ein Fehlercode zurückgesendet.
Andernfalls wird die Session mit `req.session.destroy()` regulär beendet.

### delUser
Mit dieser Route soll ein User gelöscht werden. Dazu muss der User aus der Tabelle `anwender` sowie all seine Tasks aus
`task` gelöscht werden.

``` typescript
//Funktionskette
router.delete("/delUser", checkLogin, delUser, signOut);
```

Payload im Sessionstore:
- `signInName`

Zuerst werdem in der Funktion alle Einträge aus den Tasks mit dem entsprechenden `signInName` gelöscht 

`DELETE FROM task WHERE name = signInName;`

Danach wird noch einmal eine Datenbankanfrage gesendet, die den Nutzer aus der Anwender-Tabelle löscht 

`DELETE FROM anwender WHERE name = signInName`


### addTask
Hier kann ein angemeldeter User einen eigenen Task hinzufügen.

``` typescript
//Funktionskette
router.post("/task", checkLogin, addTask);
```

Payload im Request-Body:
- `taskName`
- `taskDate`

Payload im Sessionstore:
- `sessionKey` (dieser wird benutzt, um aus der Map `userSessions` den entsprechenden `userName` zu erhalten)

In der Funktion wird die folgende Datenbankanfrage ausgelöst: 

`INSERT INTO task (name, titel, faelligkeit) VALUES (userName, taskName, taskDate);`


### delTask
Ein Task soll auch von einem Benutzer wieder gelöscht (bzw. "abgehakt") werden können.

``` typescript
//Funktionskette
router.delete("/task/:id", checkLogin, delTask);
```

Payload in der URL:
- `taskId`

Payload im Sessionstore:
- `sessionKey` (dieser wird benutzt, um aus der Map `userSessions` den entsprechenden `userName` zu erhalten)

In der Funktion wird zuerst geprüft, ob der Task wirklich zu dem anfragenden User gehört. 
Dazu wird mit einem SELECT geprüft, ob es ein Ergebnis zu der Kombination aus `signInName` und `taskId` gibt:

`SELECT * FROM task WHERE id = taskId AND name = signInName;` 

Falls es *nicht* genau einen Treffer gab, wird ein Fehler gesendet.
Wenn aber alles geklappt hat, dann wird schließlich eine zweite Anfrage abgesendet, die den Task tatsächlich löscht: 

`DELETE FROM task WHERE id = taskId;`


### updTask
Attribute von Tasks können mit dieser Route manipuliert werden.

``` typescript
//Funktionskette
router.put("/task", checkLogin, updTask);
```

Payload im Request-Body:
- `taskId`
- `taskName`
- `taskDate`

Payload im Sessionstore:
- `sessionKey` (dieser wird benutzt, um aus der Map `userSessions` den entsprechenden `userName` zu erhalten)

Zuerst wird gecheckt, ob es genau einen Treffer für die Kombination aus `userName` und `taskId` gibt: 

`SELECT * FROM task WHERE id = taskId AND name = signInName;`

Falls es *nicht* genau einen Treffer gab, wird ein Fehler gesendet.
Wenn aber alles geklappt hat, dann wird schließlich eine zweite Anfrage abgesendet, die den Datenbankeintrag dann aktualisiert: 

`UPDATE task SET titel = taskName, faelligkeit = taskDate WHERE id = taskId AND name = userName;`


### getTasks
Diese Route dient dazu, alle Tasks eines Nutzers als JSON-Objekt gebündelt zu senden.

Payload im Sessionstore:
- `sessionKey` (dieser wird benutzt, um aus der Map `userSessions` den entsprechenden `userName` zu erhalten)

Mit folgender Anfrage kann das resultierende Ergebnis als JSON-Objekt in die Response der Route übertragen werden:

`SELECT id, titel, faelligkeit FROM task WHERE name = userName;`


`res.json(result);`:
Das `result` aus der Anfrage mit gegebenenfalls mehreren Zeilen bzw. Datensätzen wird JSONifiziert und als Response (`res`) zurückgeendet.