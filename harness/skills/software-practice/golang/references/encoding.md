# Encoding

How a type turns into text, YAML, or JSON and back. The library does the work; the type implements the library's interfaces.

## A type with a text form implements the text interfaces

A type that has a text form, such as an id, a short code, or the content of a small object, MUST implement `encoding.TextMarshaler` and `encoding.TextUnmarshaler`. It MUST NOT have a public `ParseX(string)` or `Content()` beside the type. YAML, JSON, and flag libraries then read and write the type with no wrapper, and `UnmarshalText` refuses every bad form on every read.

```go
var _ encoding.TextMarshaler = (*FamilyID)(nil)
var _ encoding.TextUnmarshaler = (*FamilyID)(nil)
```

## No Encode or Decode wrappers

A package MUST NOT add `EncodeX` or `DecodeX` functions that only call `yaml.Marshal` or `json.Unmarshal`. Put the struct tags on the type, and let the caller call the library.

## A stored struct carries tags, and YAML uses yaml.v3

Every field of a struct written to YAML MUST have a `yaml:"<name>"` tag with the stored name, and `omitempty` where the format leaves the field out. Use `gopkg.in/yaml.v3`: it reads `yaml` tags and the text interfaces. `sigs.k8s.io/yaml` reads only `json` tags.

## A stored record names its format version

Every struct stored as a YAML record MUST have an integer `Version int` field with the tag `yaml:"version"`, as its first field. A writer sets it to the current format version, which starts at 1. A reader MUST refuse a missing or 0 version, and MUST still read a newer version.

## A stored value checks itself in its unmarshal method

A type with rules across its fields, such as a phase that requires a field, MUST implement `yaml.Unmarshaler` or `json.Unmarshaler`. The method decodes into a local alias type, so the decode does not recurse, and then calls the private `validate()`. So no read returns an invalid value.

```go
func (r *InstanceRecord) UnmarshalYAML(node *yaml.Node) error {
	type plain InstanceRecord
	if err := node.Decode((*plain)(r)); err != nil {
		return err
	}
	return r.validate()
}
```

Marshal does not check. A writer in the package calls `validate()` before it writes. Make `Validate()` public only when a writer outside the package must check.

## A zero value that omitempty must drop has IsZero

A struct value in a field with `omitempty` MUST have `IsZero() bool`. Without it, `yaml.v3` writes the zero struct as an empty mapping, and `omitempty` never drops it.
