# RigidBody

A rigidbody that has colliders as children will act under physics.

NOTE: contacts, triggers, forces, etc are left out of the docs until they are ratified.

### `rigidbody.type`: String

The type of rigidbody, either `static`, `kinematic` or `dynamic`. Defaults to `static`.

NOTE: if you plan to move the rigidbody with code without being dynamic, use `kinematic` for performance reasons.

### `rigidbody.onContactStart`: Function (Experimental)

The function to call when a child collider generates contacts with another rigidbody.

### `rigidbody.onContactEnd`: Function (Experimental)

The function to call when a child collider ends contacts with another rigidbody.

### `rigidbody.onTriggerEnter`: Function (Experimental)

The function to call when a child trigger collider is entered.

### `rigidbody.onTriggerLeave`: Function (Experimental)

The function to call when a child trigger collider is left.

### `rigidbody.{...Node}`

Inherits all [Node](/docs/ref/Node.md) properties

