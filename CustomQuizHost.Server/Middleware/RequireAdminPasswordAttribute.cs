using CustomQuizHost.Server.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace CustomQuizHost.Server.Middleware
{
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class RequireAdminPasswordAttribute : Attribute, IAuthorizationFilter
    {
        public const string HeaderName = "X-Admin-Password";

        public void OnAuthorization(AuthorizationFilterContext context)
        {
            var authService = context.HttpContext.RequestServices.GetRequiredService<AdminAuthService>();
            var provided = context.HttpContext.Request.Headers[HeaderName].FirstOrDefault();

            if (!authService.Verify(provided))
            {
                context.Result = new UnauthorizedResult();
            }
        }
    }
}
