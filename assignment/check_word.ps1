try {
    $word = [System.Runtime.InteropServices.Marshal]::GetActiveObject("Word.Application")
    Write-Host "Found Word Application!"
    foreach ($d in $word.Documents) {
        Write-Host "DOC_NAME: $($d.Name)"
        Write-Host "DOC_PATH: $($d.FullName)"
    }
} catch {
    Write-Host "Error accessing Word COM: $_"
}