"use client";
import { useEffect, useState } from "react";
import { sendCheckWithAI, getQuestions, getAssessment } from "./actions";
import { useParams } from "next/navigation";
import { Database } from "@/utils/supabase/database.types";
import { DropdownMenu, RadioGroup, TextArea, Button } from "@radix-ui/themes";
import Link from "next/link";
import { MathJax } from "better-react-mathjax";
import ChatWithAI from "@/components/ChatWithAI";

type Question = Database["public"]["Tables"]["questions"]["Row"];

export default function page() {
  const params = useParams();
  const [questions, setQuestions] = useState<Question[]>();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isCheckingWithAI, setIsCheckingWithAI] = useState(false);
  const [currentQuestionChat, setCurrentQuestionChat] = useState("");
  const [assessmentName, setAssessmentName] = useState("Assessment"); // TODO: Fetch assessment name

  useEffect(() => {
    getAssessment({
      assessmentId: parseInt(params.assessment_id as string),
    }).then(({ data }) => {
      setAssessmentName(data?.[0].name || "Assessment");
    });

    getQuestions({
      assessmentId: parseInt(params.assessment_id as string),
    }).then(({ data }) => {
      setQuestions(data);
      if (data && data.length > 0) {
        setCurrentAnswer(data[currentQuestion]?.given_answer || "");
      }
    });
  }, []);

  useEffect(() => {
    if (questions && questions.length > 0) {
      setCurrentAnswer(questions[currentQuestion]?.given_answer || "");
    }
  }, [currentQuestion, questions]);

  function checkWithAI({
    question,
    answer,
  }: {
    question: Question;
    answer: string;
  }) {
    setIsCheckingWithAI(true);
    sendCheckWithAI({ question, answer }).then((data) => {
      if (data.error) {
        return console.error(data.error);
      }
      setQuestions(
        questions?.map((questionItem) => {
          if (questionItem.id == question.id) {
            return {
              ...questionItem,
              is_answered: true,
              is_correct: data.correct,
            };
          }
          return questionItem;
        })
      );
      setIsCheckingWithAI(false);
    });
  }

  const currentQuestionData = questions?.[currentQuestion];
  const isAnswered = currentQuestionData?.is_answered;
  const isCorrect = currentQuestionData?.is_correct;

  const handleCheckAnswer = () => {
    if (!currentQuestionData || !currentAnswer) return;

    setQuestions(questions?.map((questionItem) => {
      if (questionItem.id == currentQuestionData.id) {
        return {
          ...questionItem,
          given_answer: currentAnswer,
        };
      }
      return questionItem;
    }));
    checkWithAI({
      question: currentQuestionData,
      answer: currentAnswer,
    });
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Question Section */}
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Link
              href={`/dashboard/practice/courses/${params.course_id}`}
              className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              <span className="text-2xl">←</span>
              <span className="ml-2">Back to Assessments</span>
            </Link>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {assessmentName}
            </h1>
            <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
              Question {currentQuestion + 1} of {questions?.length || 0}
            </p>
          </div>

          {/* Question Navigation */}
          <div className="flex items-center space-x-4">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <Button className="hover:cursor-pointer" variant="outline">
                  Select Question
                  <span className="ml-2">▼</span>
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content className="bg-white dark:bg-black/40 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                {questions?.map((question, index) => (
                  <DropdownMenu.Item
                    key={index}
                    onClick={() => {
                      setCurrentQuestion(index);
                      setCurrentAnswer(questions?.[index].given_answer ? questions?.[index].given_answer : "");
                    }}
                    className="flex items-center justify-between px-4 py-2 hover:bg-gray-100 dark:hover:bg-black/60"
                  >
                    <span>Question {index + 1}</span>
                    {question.is_correct ? (
                      <span className="text-green-500">✓</span>
                    ) : question.is_answered ? (
                      <span className="text-red-500">×</span>
                    ) : null}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            <div className="flex space-x-2">
              <Button
                onClick={() => {
                  if (questions && currentQuestion > 0) {
                    setCurrentAnswer(questions?.[currentQuestion - 1].given_answer || "");
                    setCurrentQuestion((prev) => prev - 1);
                  }
                }}
                disabled={currentQuestion === 0}
                variant="outline"
              >
                Previous
              </Button>
              <Button
                onClick={() => {
                  if (questions && currentQuestion < questions.length - 1) {
                    setCurrentAnswer(questions?.[currentQuestion + 1].given_answer || "");
                    setCurrentQuestion((prev) => prev + 1);
                  }
                }}
                disabled={
                  !questions || currentQuestion === questions.length - 1
                }
                variant="outline"
              >
                Next
              </Button>
            </div>
          </div>

          {/* Question Content */}
          {currentQuestionData && (
            <div
              className={`bg-white dark:bg-black/40 rounded-lg p-6 border-2 transition-colors
              ${
                isCorrect
                  ? "border-green-500"
                  : isAnswered
                  ? "border-red-500"
                  : "border-gray-200 dark:border-gray-700"
              }
            `}
            >
              <MathJax className="text-lg text-gray-900 dark:text-gray-100 mb-6">
                {currentQuestionData.question}
              </MathJax>

              <div className="space-y-4">
                {currentQuestionData.question_type === "MCQ" && (
                  <RadioGroup.Root
                    value={currentAnswer}
                    onValueChange={(value) => {
                      setCurrentAnswer(value);
                      setQuestions(questions?.map((questionItem) => {
                        if (questionItem.id == currentQuestionData.id) {
                          return {
                            ...questionItem,
                            given_answer: value,
                          };
                        }
                        return questionItem;
                      }));
                    }}
                    className="space-y-2"
                  >
                    {currentQuestionData.answers?.map((answer, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-black/60"
                      >
                        <RadioGroup.Item value={answer} className="w-4 h-4" />
                        <label className="text-gray-700 dark:text-gray-300">
                          {answer}
                        </label>
                      </div>
                    ))}
                  </RadioGroup.Root>
                )}

                {currentQuestionData.question_type === "BOOL" && (
                  <RadioGroup.Root
                    value={currentAnswer}
                    onValueChange={(value) => {
                      setCurrentAnswer(value);
                      setQuestions(questions?.map((questionItem) => {
                        if (questionItem.id == currentQuestionData.id) {
                          return {
                            ...questionItem,
                            given_answer: value,
                          };
                        }
                        return questionItem;
                      }));
                    }}
                    className="space-y-2"
                  >
                    {["true", "false"].map((value) => (
                      <div
                        key={value}
                        className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-black/60"
                      >
                        <RadioGroup.Item value={value} className="w-4 h-4" />
                        <label className="text-gray-700 dark:text-gray-300 capitalize">
                          {value}
                        </label>
                      </div>
                    ))}
                  </RadioGroup.Root>
                )}

                {currentQuestionData.question_type === "LATEX" && (
                  <TextArea
                    value={currentAnswer}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCurrentAnswer(value);
                      setQuestions(questions?.map((questionItem) => {
                        if (questionItem.id == currentQuestionData.id) {
                          return {
                            ...questionItem,
                            given_answer: value,
                          };
                        }
                        return questionItem;
                      }));
                    }}
                    placeholder="Enter your answer here..."
                    className="w-full min-h-[100px] p-3 rounded-lg border border-gray-200 dark:border-gray-700
                             bg-white dark:bg-black/40 text-gray-900 dark:text-gray-100"
                  />
                )}
              </div>

              <div className="flex items-center space-x-4 mt-6">
                <Button
                  onClick={handleCheckAnswer}
                  disabled={isCheckingWithAI || !currentAnswer}
                  className={(isCheckingWithAI || !currentAnswer) ? "" : "bg-blue-600 hover:bg-blue-700 text-white"}
                >
                  {isCheckingWithAI ? "Checking..." : "Check With AI"} ✨
                </Button>

                <button
                  onClick={() => {
                    const eventStream = new EventSource(
                      `http://localhost:8000/explanation?problem=${encodeURIComponent(
                        currentQuestionData.question || ""
                      )}`
                    );
                    eventStream.onmessage = (e) => {
                      console.log("woah", e.data);
                      if (e.data === "[DONE]") {
                        eventStream.close();
                        return;
                      }
                      setCurrentQuestionChat((prev) => prev + e.data);
                    };
                    eventStream.onerror = (e) => {
                      console.error(e);
                      eventStream.close();
                    };
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Need help with this question?
                </button>
              </div>

              {isAnswered && (
                <div
                  className={`mt-4 p-4 rounded-lg ${
                    isCorrect
                      ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                      : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                  }`}
                >
                  {isCorrect
                    ? "Correct! Well done!"
                    : (
                      <>
                        Not quite right. Try again or check the explanation.{" "}
                        <button
                          onClick={() => {
                            if (!currentQuestionData) return;
                            
                            // Create EventSource for streaming response
                            const eventSource = new EventSource(
                              `http://localhost:8000/explain_wrong_answer?question=${encodeURIComponent(
                                currentQuestionData.question || ""
                              )}&answer=${encodeURIComponent(currentAnswer || "")}`
                            );
                            
                            // Handle incoming messages
                            eventSource.onmessage = (event) => {
                              if (event.data === "[DONE]") {
                                eventSource.close();
                                return;
                              }
                              setCurrentQuestionChat((prev) => prev + event.data);
                            };
                            
                            // Handle errors
                            eventSource.onerror = (error) => {
                              console.error("EventSource error:", error);
                              eventSource.close();
                              setCurrentQuestionChat((prev) => prev + "\n\nError: Could not get explanation. Please try again.");
                            };
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          See why this is wrong
                        </button>
                      </>
                    )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Chat Section */}
        <div className="lg:border-l lg:border-gray-200 lg:dark:border-gray-700 lg:pl-8">
          <ChatWithAI
            currentQuestionChat={currentQuestionChat}
            setCurrentQuestionChat={setCurrentQuestionChat}
          />
        </div>
      </div>
    </div>
  );
}
