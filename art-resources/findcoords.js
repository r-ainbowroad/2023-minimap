try
{
    var s = app.activeDocument.selection.bounds
    alert((s[0]-1500)+","+(s[1]-1000)+","+(s[2]-1500)+","+(s[3]-1000)) // 0 and 1 are x and y for top left corner and 2 and 3 are x and y for bottom right corner.
}
catch(e) {}