package htmluibuild

import (
	"io"
	"regexp"
	"strings"
	"testing"
)

func TestAssetFile(t *testing.T) {
	assets := AssetFile()
	index, err := assets.Open("index.html")
	if err != nil {
		t.Fatal(err)
	}
	defer index.Close()

	content, err := io.ReadAll(index)
	if err != nil {
		t.Fatal(err)
	}

	if !strings.Contains(string(content), `lang="zh-CN"`) {
		t.Fatal("expected Chinese document language")
	}

	matches := regexp.MustCompile(`(?:src|href)="(/assets/[^"]+)"`).FindAllSubmatch(content, -1)
	if len(matches) == 0 {
		t.Fatal("no built assets referenced by index.html")
	}

	for _, match := range matches {
		name := strings.TrimPrefix(string(match[1]), "/")
		f, err := assets.Open(name)
		if err != nil {
			t.Errorf("missing asset %q: %v", name, err)
			continue
		}
		f.Close()
	}
}
