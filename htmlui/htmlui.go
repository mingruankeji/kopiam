package htmluibuild

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed dist
var assets embed.FS

// AssetFile exposes the built Kopia UI as a filesystem rooted at index.html.
func AssetFile() http.FileSystem {
	root, err := fs.Sub(assets, "dist")
	if err != nil {
		panic(err)
	}

	return http.FS(root)
}
