try
{
    var s = app.activeDocument.selection.bounds
    alert((s[0]-1000)+","+(s[1]-500)+","+(s[2]-1000)+","+(s[3]-500)) // 0 and 1 are x and y for top left corner and 2 and 3 are x and y for bottom right corner.
}
catch(e) {}