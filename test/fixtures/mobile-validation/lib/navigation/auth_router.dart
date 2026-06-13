const loginRoute = "/login";
const homeRoute = "/home";

String routeAfterLogin(bool sessionValid) {
  return sessionValid ? homeRoute : loginRoute;
}
