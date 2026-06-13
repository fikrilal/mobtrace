const loginEndpoint = "/auth/login";

Map<String, String> loginPayload(String email, String password) {
  return {
    "email": email,
    "password": password,
  };
}
