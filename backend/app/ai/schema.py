"""Shape a JSON Schema so a provider will actually serve it.

Pydantic emits every constraint it knows: numeric bounds, string lengths, array
limits. Google AI Studio rejects such a schema outright — "the specified schema
produces a constraint that has too many states for serving" — and a rejected
schema means a 400 for the whole request, not a looser answer.

Dropping the constraints from the wire copy costs nothing: the schema is a hint
that steers the model's shape, while the guarantee has always been our own
Pydantic validation of whatever comes back.
"""

# validation keywords that make schemas expensive to serve
_UNSERVABLE = frozenset(
    {
        "minimum",
        "maximum",
        "exclusiveMinimum",
        "exclusiveMaximum",
        "multipleOf",
        "minLength",
        "maxLength",
        "pattern",
        "format",
        "minItems",
        "maxItems",
        "uniqueItems",
        # pure noise for the model, and the error blames schema text length too
        "title",
    }
)

# keys whose children are user-chosen names, not schema keywords
_NAME_MAPS = frozenset({"properties", "$defs", "definitions", "patternProperties"})


def for_provider(node: object) -> object:
    """Prepare a schema for the wire: strip serving-hostile keywords, then make
    every property required.

    Requiring everything is what actually gets fields filled. Under constrained
    decoding an object with only optional properties is already satisfied by
    `{}`, so the model is free to stop after two or three fields — and it does,
    no matter how firmly the prompt asks for the rest. Optional fields are
    nullable or arrays anyway, so "required" costs the model nothing: it can
    still answer null or [] where the documents say nothing.
    """
    return _require_all(_strip(node))


def _strip(node: object) -> object:
    if isinstance(node, list):
        return [_strip(item) for item in node]
    if not isinstance(node, dict):
        return node

    shaped: dict[str, object] = {}
    for key, value in node.items():
        if key in _UNSERVABLE:
            continue
        if key in _NAME_MAPS and isinstance(value, dict):
            # a field may legitimately be called "format" or "pattern"
            shaped[key] = {name: _strip(child) for name, child in value.items()}
        else:
            shaped[key] = _strip(value)
    return shaped


def _require_all(node: object) -> object:
    if isinstance(node, list):
        return [_require_all(item) for item in node]
    if not isinstance(node, dict):
        return node

    shaped: dict[str, object] = {}
    for key, value in node.items():
        if key in _NAME_MAPS and isinstance(value, dict):
            shaped[key] = {name: _require_all(child) for name, child in value.items()}
        else:
            shaped[key] = _require_all(value)
    properties = shaped.get("properties")
    if isinstance(properties, dict) and properties:
        shaped["required"] = list(properties)
    return shaped
