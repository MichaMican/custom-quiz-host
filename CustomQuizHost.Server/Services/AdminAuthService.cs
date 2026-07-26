using System.Security.Cryptography;
using System.Text;

namespace CustomQuizHost.Server.Services
{
    public class AdminAuthService
    {
        private const string DefaultPassword = "14mUns4f3";
        private readonly byte[] _passwordBytes;

        public AdminAuthService()
        {
            var configured = Environment.GetEnvironmentVariable("ADMIN_PAGE_PASSWORD");
            var password = string.IsNullOrEmpty(configured) ? DefaultPassword : configured;
            _passwordBytes = Encoding.UTF8.GetBytes(password);
        }

        public bool Verify(string? candidate)
        {
            if (candidate == null)
                return false;

            var candidateBytes = Encoding.UTF8.GetBytes(candidate);
            return CryptographicOperations.FixedTimeEquals(candidateBytes, _passwordBytes);
        }
    }
}
