require.config({
    baseUrl: "js",
    waitSeconds: 15
});

/*
chrome.app.window.create('sandbox.html', {
                    frame: 'chrome',
                    width: 720,
                    height: 400
                });
*/              
require(["./fs/web", "./lib/fuzzyfind"], function(webfs, fuzzyfind) {
    
    var projectWindows = {};
    
    function getKey(key, callback) {
        if(chrome.storage) {
            chrome.storage.sync.get(key, function(results) {
                callback(results[key]);
            });
        } else {
            callback(localStorage[key]);
        }
    }
    
    function setKey(key, value) {
        if(chrome.storage) {
            var obj = {};
            obj[key] = value;
            chrome.storage.sync.set(obj);
        } else {
            localStorage[key] = value;
        }
    }
    
    getKey("projects", function(projects) {
        projects = projects || {};
        
        if(!projects.Settings) {
            projects.Settings = {
                url: "settings:"
            };
        }
        if(!projects.Manual) {
            projects.Manual = {
                url: "manual:"
            };
        }
        
        var input = $("#gotoinput");
        var resultsEl = $("#results");
        resultsEl.menu({
            select: function(event, ui) {
                event.preventDefault();
                open();
            }
        });
        
        function open() {
            var projectName = resultsEl.find("a.ui-state-focus").text();
            if(!projectName) {
                $("#addform").show();
                $("#url").focus();
                $("#hint").html("Press <tt>Return</tt> to create.");
                updateWindowSize();
                return;
            }
            if(projectWindows[projectName]) {
                projectWindows[projectName].show();
            } else {
                var project = projects[projectName];
                project.lastUse = Date.now();
                saveProjects();
                chrome.app.window.create('editor.html?url=' + project.url +
                                         '&username=' + project.username +
                                         '&password=' + project.password +
                                         '&chromeapp=true', {
                    frame: 'chrome',
                    width: 720,
                    height: 400,
                }, function(win) {
                    projectWindows[projectName] = win;
                    window.win = win;
                    win.onClosed.addListener(function() {
                        projectWindows[projectName] = undefined;
                    });
                });
            }
            close();
        }
        
        function remove() {
            var projectName = resultsEl.find("a.ui-state-focus").text();
            delete projects[projectName];
            saveProjects();
        }
        
        function close() {
            chrome.app.window.current().hide();
            // Reset UI for next showing
            $("#addform").hide();
            input.val("");
            renderProjects();
        }
        
        function saveProjects() {
            setKey("projects", projects);
        }
        
        function updateWindowSize() {
            var win = chrome.app.window.current();
            win.resizeTo(400, $("body").height());
        }
        
        function renderProjects() {
            var allProjects = Object.keys(projects);
            resultsEl.empty();
            var matchingProjects = fuzzyfind(allProjects, input.val());
            matchingProjects.sort(function(a, b) {
                if(a.score === b.score) {
                    return projects[b.path].lastUse - projects[a.path].lastUse;
                } else {
                    return b.score - a.score;
                }
            });
            matchingProjects.forEach(function(match) {
                var project = projects[match.path];
                var projectName = match.path;
                var el = $("<li>");
                var textEl = $("<a href='#'>");
                textEl.text(projectName);
                el.append(textEl);
                resultsEl.append(el);
            });
            resultsEl.menu("refresh");
            if(matchingProjects.length > 0) {
                resultsEl.menu("next");
                $("#hint").html("Press <tt>Return</tt> to <u>open</u> or <tt>Shift-Delete</tt> to <u>delete</u>.");
            } else {
                $("#hint").html("Press <tt>Return</tt> to <u>create</u> project with this name.");
            }
            input.focus();
            updateWindowSize();
        }
        
        renderProjects();
        input.keyup(function(event) {
            switch(event.keyCode) {
                case 38: // up
                    resultsEl.menu("previous");
                    break;
                case 40: // down
                    resultsEl.menu("next");
                    break;
                case 13: // Return
                    open();
                    break;
                case 9: // tab
                    break;
                case 46: // Delete
                    if(event.shiftKey) {
                        remove();
                    }
                default:
                    renderProjects();
            }
        });
        input.keydown(function(event) {
            switch(event.keyCode) {
                case 9: // Tab
                    if(event.shiftKey)
                        resultsEl.menu("previous");
                    else
                        resultsEl.menu("next");
                    event.preventDefault();
                    event.stopPropagation();
                    break;
            }
        });
        $(window).keyup(function(event) {
            if(event.keyCode == 27) { // Esc
                close();
            }
        });
        
        $("#addform").hide().submit(function(event) {
            var name = input.val();
            var url = $("#url").val();
            var username = $("#username").val() || undefined;
            var password = $("#password").val() || undefined;
            var io = webfs(url, username, password);
            $("#status").text("Verifying...");
            io.writeFile("/__zedtest.txt", "testing", function(err) {
                if(err) {
                    if(err.indexOf("Unauthorized") !== -1) {
                        $(".authenticate").fadeIn();
                        return $("#status").text("Provide username and password and try again.");
                    } else {
                        return $("#status").text("Error: " + err);
                    }
                }
                io.readFile("/__zedtest.txt", function(err, result) {
                    if(err) {
                        return $("#status").text("Error: " + err);
                    }
                    if(result !== "testing") {
                        return $("#status").text("Invalid tet retrieved: " + result);
                    }
                    io.deleteFile("/__zedtest.txt", function(err) {
                        if(err) {
                            console.error("Could not delete test file:", err);
                        }
                    });
                    projects[name] = {
                        url: url,
                        username: username,
                        password: password
                    };
                    saveProjects();
                    $("#name").val("");
                    $("#url").val("http://");
                    $("#addform").hide();
                    renderProjects();
                    $("#status").text();
                });
            })
            event.preventDefault();
        });
        updateWindowSize();
    });

});
