const { Amplify } = aws_amplify;

const awsconfig = {
    "aws_project_region": "us-east-1",
    "aws_cognito_region": "us-east-1",
    "aws_user_pools_id": "us-east-1_YK7Q60V8o",
    "aws_user_pools_web_client_id": "1uh3r35aemfub1ee1lin6o8lb1",
    "oauth": {},
    "aws_cloud_logic_custom": [
        {
            "name": "api",
            "endpoint": "https://wszwvwc915.execute-api.us-east-1.amazonaws.com/prod",
            "region": "us-east-1"
        }
    ]
};

Amplify.configure(awsconfig);

export default awsconfig;
