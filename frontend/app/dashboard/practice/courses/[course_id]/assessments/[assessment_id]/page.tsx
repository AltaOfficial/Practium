"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { sendCheckWithAI, getQuestions, getAssessment } from "./actions";
import { useParams } from "next/navigation";
import { Database } from "@/utils/supabase/database.types";
import { DropdownMenu, RadioGroup, Button, Tooltip } from "@radix-ui/themes";
import useSWR from "swr";
import {
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiX,
} from "react-icons/fi";
import {
  FaKeyboard,
  FaListUl,
  FaPen,
  FaRedo,
  FaRegLightbulb,
} from "react-icons/fa";
import { MathJax } from "better-react-mathjax";
import ChatWithAI, {
  parseStreamChunk,
  USER_START,
  USER_END,
  ASSISTANT_BREAK,
} from "@/components/ChatWithAI";
import Image from "next/image";
import DrawingBoard, { DrawingBoardRef } from "@/components/DrawingBoard";

type Question = Database["public"]["Tables"]["questions"]["Row"];

interface VideoSuggestion {
  thumbnailUrl: string;
  videoId: string;
}

// Each part of a multi-part question is its own row; rows that share a
// group_number form one question. Rows without one are standalone questions.
function groupQuestions(questions: Question[] = []): Question[][] {
  const groups: Question[][] = [];
  for (const question of questions) {
    const last = groups[groups.length - 1];
    if (
      question.group_number != null &&
      last?.[0].group_number === question.group_number
    ) {
      last.push(question);
    } else {
      groups.push([question]);
    }
  }
  return groups;
}

const partLabel = (index: number) => String.fromCharCode(97 + index);

// Any question can be answered on the drawing board, in which case its
// given_answer holds the board's paths as JSON rather than a typed answer.
function parseDrawing(answer: string | null) {
  if (!answer?.startsWith("[{")) return null;
  try {
    const paths = JSON.parse(answer);
    return Array.isArray(paths) && Array.isArray(paths[0]?.paths)
      ? paths
      : null;
  } catch {
    return null;
  }
}

const isDrawnAnswer = (question: Question) =>
  question.question_type === "DRAWING" ||
  parseDrawing(question.given_answer) !== null;

// The full problem for one part: the shared context, the earlier parts with
// the student's answers, then the part itself.
function describeAnswer(question: Question) {
  const answer =
    isDrawnAnswer(question)
      ? question.given_answer
        ? "(answered with a drawing)"
        : ""
      : question.given_answer;
  const mark = !question.is_answered
    ? "not checked yet"
    : question.is_correct
    ? "marked correct"
    : "marked incorrect";
  return `Student's answer: ${
    answer ? `${answer} (${mark})` : "(not answered yet)"
  }`;
}

// A question can come with a figure. The grader and the tutor can't see it,
// so they are told what it shows.
const describeFigure = (question: Question) =>
  question.image_url && question.image_description
    ? `\n\nThe question comes with a figure. It shows: ${question.image_description}`
    : "";

// A standalone question with its figure, if it has one.
const questionWithFigure = (question: Question) =>
  `${question.question || ""}${describeFigure(question)}`;

// What the student is looking at, for follow-up messages in the chat: the
// question (every part of it, for a multi-part question) and their answers.
function buildChatContext(parts: Question[], partIndex: number) {
  if (parts[partIndex].group_number == null) {
    return `Question: ${questionWithFigure(parts[partIndex])}\n${describeAnswer(
      parts[partIndex]
    )}`;
  }
  return [
    `Shared context:\n${parts[partIndex].context || ""}${describeFigure(
      parts[partIndex]
    )}`,
    ...parts.map(
      (part, index) =>
        `Part (${partLabel(index)}): ${part.question}\n${describeAnswer(part)}`
    ),
    `The student is currently on part (${partLabel(partIndex)}).`,
  ].join("\n\n");
}

function buildPartPrompt(parts: Question[], partIndex: number) {
  const earlierParts = parts
    .slice(0, partIndex)
    .map(
      (part, index) =>
        `Part (${partLabel(index)}): ${part.question}\n${describeAnswer(part)}`
    );

  return [
    `This is one part of a multi-part question.`,
    `Shared context:\n${parts[partIndex].context || ""}${describeFigure(
      parts[partIndex]
    )}`,
    ...(earlierParts.length > 0
      ? [`Earlier parts:\n\n${earlierParts.join("\n\n")}`]
      : []),
    `The part to answer now, part (${partLabel(partIndex)}):\n${
      parts[partIndex].question
    }`,
  ].join("\n\n");
}

export default function AssessmentPage() {
  const params = useParams();
  const [questions, setQuestions] = useState<Question[]>();
  // index of the current question, and of the part within it
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [currentPart, setCurrentPart] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isCheckingWithAI, setIsCheckingWithAI] = useState(false);
  const [currentQuestionChat, setCurrentQuestionChat] = useState("");
  const [assessmentName, setAssessmentName] = useState("Assessment"); // TODO: Fetch assessment name
  const [isVideosVisible, setIsVideosVisible] = useState(false);
  const [videoSuggestions, setVideoSuggestions] = useState<VideoSuggestion[]>([]);
  const boardRef = useRef<DrawingBoardRef>(null);
  // whether the current question is being answered on the drawing board
  const [usingBoard, setUsingBoard] = useState(false);

  const questionGroups = useMemo(() => groupQuestions(questions), [questions]);
  const currentParts = questionGroups[currentQuestion] || [];
  const currentQuestionData = currentParts[currentPart];
  const isMultiPart = currentQuestionData?.group_number != null;

  const goToQuestion = (index: number) => {
    if (index < 0 || index >= questionGroups.length) return;
    setCurrentPart(0);
    setCurrentQuestion(index);
  };

  type Video = {
    videoRenderer: {
      thumbnail: {
        thumbnails: { url: string }[];
      };
      videoId: string;
    };
  }
  
  const { mutate: mutateVideoSuggestions } = useSWR(`${process.env.NODE_ENV == "production" ? process.env.NEXT_PUBLIC_BACKEND_URL : "http://localhost:8000"}/get_youtube_video_suggestions`, {
    fetcher: async (url: string) => {
      if(currentQuestionData) {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ question: currentQuestionData }),
        });

        const data = await response.json();
        
        const videoSuggestions = data.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents.reduce((videoSuggestions: VideoSuggestion[], video: Video) => {
          if(video.videoRenderer) {
            // sometimes video is a short or not a video that we want to use, this filters out those
            return [...videoSuggestions, {
              thumbnailUrl: video.videoRenderer.thumbnail.thumbnails[0].url,
              videoId: video.videoRenderer.videoId,
            }];
          }
          return videoSuggestions;
        }, []);

        return videoSuggestions.splice(0, 10);
      }
    },
  });

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
    });

    return () => {
      setCurrentQuestionChat("");
      setCurrentAnswer("");
    }
  }, [questions?.length]);

  // this is ran after questions in loaded
  useEffect(() => {
    // if the user has answered the question in the past, set the current answer for that question to the previous answer upon loading the assesment again

    if (currentQuestionData) {
      setCurrentAnswer(currentQuestionData.given_answer || "");
      setUsingBoard(isDrawnAnswer(currentQuestionData));
    }

    mutateVideoSuggestions().then((data) => {
      setVideoSuggestions(data || []);
    });
  }, [currentQuestion, currentPart, questions?.length]);

  // put the saved drawing on the board whenever it shows a different question
  useEffect(() => {
    if (usingBoard && currentQuestionData) {
      boardRef.current?.load(
        parseDrawing(currentQuestionData.given_answer) || []
      );
    }
  }, [usingBoard, currentQuestion, currentPart, questions?.length]);

  // sets the answer of the current question
  const setAnswer = (value: string) => {
    setCurrentAnswer(value);
    setQuestions(
      questions?.map((questionItem) =>
        questionItem.id == currentQuestionData?.id
          ? { ...questionItem, given_answer: value }
          : questionItem
      )
    );
  };

  // the chat is shared by all parts of a question, so it only resets when the question changes
  useEffect(() => {
    return () => {
      setCurrentQuestionChat("");
    }
  }, [currentQuestion, questions?.length]);

  function checkWithAI({
    question,
    answer,
  }: {
    question: Question;
    answer: string;
  }) {
    setIsCheckingWithAI(true);
    sendCheckWithAI({
      question,
      answer,
      canvasPath: usingBoard ? currentAnswer : undefined,
      courseId: params.course_id as string,
      // parts are graded with the shared context and the earlier parts,
      // and a question with a figure with what the figure shows
      questionText: isMultiPart
        ? buildPartPrompt(currentParts, currentPart)
        : describeFigure(question)
        ? questionWithFigure(question)
        : undefined,
    }).then(
      (data) => {
        if (data.error) {
          setIsCheckingWithAI(false);
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
      // the grader sometimes says where a wrong answer went wrong; show it in the chat
      if (!data.correct && data.feedback) {
        const feedback = isMultiPart
          ? `**Part (${partLabel(currentPart)}):** ${data.feedback}`
          : data.feedback;
        // its own message, even right after another one from the assistant
        setCurrentQuestionChat((prev) => prev + ASSISTANT_BREAK + feedback);
      }
      setIsCheckingWithAI(false);
    });
  }

  // streams an explanation of the current question into the chat
  const explainQuestion = () => {
    if (!currentQuestionData) return;
    // for a part, send the shared context and the earlier parts with their answers too
    const problem = isMultiPart
      ? buildPartPrompt(currentParts, currentPart)
      : questionWithFigure(currentQuestionData);
    if (isMultiPart) {
      // the chat spans all parts, so label which part this explanation is for
      setCurrentQuestionChat(
        (prev) =>
          prev +
          USER_START +
          `How do I solve part (${partLabel(currentPart)})?` +
          USER_END
      );
    } else {
      // its own message, even right after another one from the assistant
      setCurrentQuestionChat((prev) => prev + ASSISTANT_BREAK);
    }
    const eventStream = new EventSource(
      `${process.env.NODE_ENV == "production" ? process.env.NEXT_PUBLIC_BACKEND_URL : "http://localhost:8000"}/explanation?problem=${encodeURIComponent(
        problem
      )}&course_id=${params.course_id}`
    );
    eventStream.onmessage = (e) => {
      if (e.data === "[DONE]") {
        eventStream.close();
        return;
      }
      // Chunks are JSON-encoded so newlines survive the event stream
      const chunk = parseStreamChunk(e.data);
      setCurrentQuestionChat((prev) => prev + chunk);
    };
    eventStream.onerror = (e) => {
      console.error(e);
      eventStream.close();
    };
  };

  const iconButton =
    "!bg-transparent w-9 h-9 flex items-center justify-center outline-none !border-2 !border-[#333333] text-[#333333] rounded-[4px] disabled:opacity-40";

  const isAnswered = currentQuestionData?.is_answered;
  const isCorrect = currentQuestionData?.is_correct;

  // the question's figure; the parts of a multi-part question share one, shown with their context
  const questionFigure = (className: string) =>
    currentQuestionData?.image_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={currentQuestionData.image_url}
        src={currentQuestionData.image_url}
        alt={currentQuestionData.image_description || "Figure for the question"}
        className={`block w-auto max-w-full rounded-md border border-gray-200 bg-white ${className}`}
      />
    ) : null;

  const handleCheckAnswer = () => {
    if (!currentQuestionData || !currentAnswer) return;

    if (usingBoard) {
      boardRef.current?.exportImage().then((data) => {
        checkWithAI({
          question: currentQuestionData,
          answer: data,
        });
      });
    } else {
      setQuestions(
        questions?.map((questionItem) => {
          if (questionItem.id == currentQuestionData.id) {
            return {
              ...questionItem,
              given_answer: currentAnswer,
            };
          }
          return questionItem;
        })
      );
      checkWithAI({
        question: currentQuestionData,
        answer: currentAnswer,
      });
    }
  };

  // useEffect(() => {
  //   if(questions && questions.length > 0) {
  //     const { data } = useSWR(
  //       async () => {
  //         return await getYoutubeVideoSuggestions({
  //           question: questions[currentQuestion],
  //         });
  //       },
  //       {
  //         revalidateOnFocus: false,
  //       }
  //     );
  //     setVideoSuggestions(data || []);
  //   }
  // }, [currentQuestion, questions?.length]);

  // const { data: videoSuggestionsData, mutate: mutateVideoSuggestions } = useSWR(
  // async () => {
  //     console.log("getting video suggestions");
  //     if(questions && questions.length > 0) {
  //       const data = await getYoutubeVideoSuggestions({
  //         question: questions[currentQuestion],
  //       })
  //       // setVideoSuggestions(data?.data || []);
  //     }
  //   },
  //   {
  //     revalidateOnFocus: false,
  //   }
  // );

  // setVideoSuggestions(videoSuggestionsData?.data || []);

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full overflow-hidden">
        {/* Left Column - Question Section */}
        <div className="flex flex-col space-y-6 flex-1 ">
          <div className="flex flex-col space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-[#333333]">
                {assessmentName}
              </h1>
              <p className="mt-2 text-lg text-[#878787] ">
                Question {currentQuestion + 1} of {questionGroups.length}
              </p>
            </div>

            {/* Question Navigation */}
            <div className="flex items-center space-x-4">
              <div className="flex space-x-2 justify-between w-full">
                <div className="flex items-center gap-2">
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                      <button className="!bg-transparent flex items-center outline-none px-3 py-1.5 !border-2 !border-[#333333] text-[#333333] text-sm rounded-[4px] font-medium">
                        Select Question
                        <FiChevronDown size={20} className="ml-2" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content className="bg-[#333333] shadow-lg">
                      {questionGroups.map((parts, index) => (
                        <DropdownMenu.Item
                          key={index}
                          onClick={() => {
                            goToQuestion(index);
                          }}
                          className="flex items-center justify-between px-4 py-2 hover:bg-[#333333]"
                        >
                          <span>Question {index + 1}</span>
                          {parts.every((part) => part.is_correct) ? (
                            <span className="text-green-500">✓</span>
                          ) : parts.some(
                              (part) => part.is_answered && !part.is_correct
                            ) ? (
                            <span className="text-red-500">×</span>
                          ) : null}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>

                  <Tooltip content="Get a similar question">
                    <button
                      aria-label="Get a similar question"
                      onClick={() => goToQuestion(currentQuestion + 1)}
                      className={iconButton}
                    >
                      <FaRedo size={16} />
                    </button>
                  </Tooltip>

                  {/* a drawing question is always answered on the board */}
                  {currentQuestionData?.question_type !== "DRAWING" && (
                    <Tooltip
                      content={
                        usingBoard
                          ? currentQuestionData?.question_type === "LATEX"
                            ? "Type my answer instead"
                            : "Pick from the choices instead"
                          : "Answer on the drawing board"
                      }
                    >
                      <button
                        aria-label="Switch between the drawing board and the regular answer"
                        disabled={!currentQuestionData}
                        onClick={() => {
                          // a typed answer and a drawing can't stand in for each other
                          setAnswer("");
                          setUsingBoard(!usingBoard);
                        }}
                        className={iconButton}
                      >
                        {!usingBoard ? (
                          <FaPen size={15} />
                        ) : currentQuestionData?.question_type === "LATEX" ? (
                          <FaKeyboard size={17} />
                        ) : (
                          <FaListUl size={16} />
                        )}
                      </button>
                    </Tooltip>
                  )}

                  <Tooltip content="How do I solve this?">
                    <button
                      aria-label="How do I solve this?"
                      disabled={!currentQuestionData}
                      onClick={explainQuestion}
                      className={iconButton}
                    >
                      <FaRegLightbulb size={17} />
                    </button>
                  </Tooltip>
                </div>

                <button
                  onClick={() => goToQuestion(currentQuestion + 1)}
                  className="!bg-[#333333] justify-end flex items-center outline-none px-3 py-1.5 !border-2 !border-[#333333] text-white text-sm rounded-[4px] font-medium hover:opacity-90"
                >
                  Next Question
                  <FiChevronRight size={20} className="ml-2" />
                </button>
              </div>
            </div>

            {/* Question Content */}
            {currentQuestionData ? (
              <div
                className={`bg-white rounded-lg p-6 transition-colors
              ${
                isCorrect
                  ? "border-2 border-green-500"
                  : isAnswered
                  ? "border-2 border-red-500"
                  : "border-0"
              }
            `}
              >
                {isMultiPart && (
                  <>
                    {/* Context shared by every part */}
                    <div className="mb-4">
                      <MathJax inline dynamic className="text-[#333333]">
                        {currentQuestionData.context}
                      </MathJax>
                      {questionFigure("mt-4 max-h-80")}
                    </div>

                    {/* Part switcher */}
                    <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200">
                      {currentParts.map((part, index) => (
                        <button
                          key={part.id}
                          onClick={() => setCurrentPart(index)}
                          title={`Part ${partLabel(index)}`}
                          className={`w-8 h-8 flex items-center justify-center outline-none !border-2 text-sm rounded-[4px] font-medium ${
                            part.is_correct
                              ? "!border-green-500"
                              : part.is_answered
                              ? "!border-red-500"
                              : "!border-[#333333]"
                          } ${
                            index === currentPart
                              ? "!bg-[#333333] text-white"
                              : "!bg-transparent text-[#333333]"
                          }`}
                        >
                          {partLabel(index)}
                        </button>
                      ))}
                      <span className="ml-2 text-sm text-[#878787]">
                        Part {currentPart + 1} of {currentParts.length}
                      </span>
                    </div>
                  </>
                )}

                <div className="mb-6">
                  {isMultiPart && (
                    <span className="mr-2 font-semibold text-[#333333]">
                      ({partLabel(currentPart)})
                    </span>
                  )}
                  <MathJax inline dynamic className="text-[#333333]">
                    {currentQuestionData.question}
                  </MathJax>
                  {!isMultiPart && questionFigure("mt-4 max-h-80")}
                </div>

                <div className="space-y-4">
                  {usingBoard &&
                    currentQuestionData.question_type === "MCQ" &&
                    currentQuestionData.answers && (
                      <MathJax dynamic className="text-[#333333] text-sm">
                        <ul className="list-disc pl-5 space-y-1">
                          {currentQuestionData.answers.map((answer, index) => (
                            <li key={index}>{answer}</li>
                          ))}
                        </ul>
                      </MathJax>
                    )}

                  {!usingBoard && currentQuestionData.question_type === "MCQ" && (
                    <RadioGroup.Root
                      value={currentAnswer}
                      onValueChange={(value) => {
                        setCurrentAnswer(value);
                        setQuestions(
                          questions?.map((questionItem) => {
                            if (questionItem.id == currentQuestionData.id) {
                              return {
                                ...questionItem,
                                given_answer: value,
                              };
                            }
                            return questionItem;
                          })
                        );
                      }}
                      className="space-y-2"
                    >
                      <MathJax inline dynamic className="text-[#333333]">
                      {currentQuestionData.answers?.map((answer, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-3 p-3"
                        >
                          <RadioGroup.Item
                            value={answer}
                            className="w-4 h-4 !border-2 before:!bg-transparent before:!border-2 before:!border-[#333333] data-[state=checked]:after:!bg-[#333333]"
                          />
                          <label className="text-[#333333]">{answer}</label>
                        </div>
                      ))}
                      </MathJax>
                    </RadioGroup.Root>
                  )}

                  {usingBoard && (
                    <DrawingBoard
                      ref={boardRef}
                      onChange={setAnswer}
                      fullscreenHeader={
                        <>
                          {isMultiPart && (
                            <div className="mb-2">
                              <MathJax inline dynamic>
                                {currentQuestionData.context}
                              </MathJax>
                            </div>
                          )}
                          {isMultiPart && (
                            <span className="mr-2 font-semibold">
                              ({partLabel(currentPart)})
                            </span>
                          )}
                          <MathJax inline dynamic>
                            {currentQuestionData.question}
                          </MathJax>
                          {questionFigure("mt-2 max-h-48")}
                        </>
                      }
                    />
                  )}

                  {!usingBoard && currentQuestionData.question_type === "BOOL" && (
                    <RadioGroup.Root
                      value={currentAnswer}
                      onValueChange={(value) => {
                        setCurrentAnswer(value);
                        setQuestions(
                          questions?.map((questionItem) => {
                            if (questionItem.id == currentQuestionData.id) {
                              return {
                                ...questionItem,
                                given_answer: value,
                              };
                            }
                            return questionItem;
                          })
                        );
                      }}
                      className="space-y-2"
                    >
                      {["true", "false"].map((value) => (
                        <div
                          key={value}
                          className="flex items-center space-x-3 p-3"
                        >
                          <RadioGroup.Item
                            value={value}
                            className="w-4 h-4 !border-2 before:!bg-transparent before:!border-2 before:!border-[#333333] data-[state=checked]:after:!bg-[#333333]"
                          />
                          <label className="text-[#333333] capitalize">
                            {value}
                          </label>
                        </div>
                      ))}
                    </RadioGroup.Root>
                  )}

                  {!usingBoard && currentQuestionData.question_type === "LATEX" && (
                    <textarea
                      value={currentAnswer}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCurrentAnswer(value);
                        setQuestions(
                          questions?.map((questionItem) => {
                            if (questionItem.id == currentQuestionData.id) {
                              return {
                                ...questionItem,
                                given_answer: value,
                              };
                            }
                            return questionItem;
                          })
                        );
                      }}
                      placeholder="Enter your answer here..."
                      className="w-full min-h-[125px] p-3 rounded-md border text-sm border-[#333333] outline-none shadow-[1.5px_3px_0_0px_rgba(51,51,51,1)]
                             !bg-white !text-[#333333] "
                    />
                  )}
                </div>

                <div className="flex justify-between items-center space-x-4 mt-6">
                  <div className="flex items-center space-x-4">
                    <Button
                      onClick={handleCheckAnswer}
                      disabled={isCheckingWithAI || !currentAnswer}
                      className={
                        isCheckingWithAI || !currentAnswer
                          ? " !bg-[#878787] !text-white"
                          : "!bg-[#333333] !text-white"
                      }
                    >
                      {isCheckingWithAI ? "Checking..." : "Check With AI"} ✨
                    </Button>

                  </div>

                  {currentQuestionData.is_answered &&
                    !currentQuestionData.is_correct && (
                      <FiX size={20} className="text-red-500" />
                    )}
                  {currentQuestionData.is_correct == true && (
                    <FiCheck size={20} className="text-green-500" />
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg p-6 animate-pulse">
                {/* Question text skeleton */}
                <div className="space-y-3 mb-6">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>

                {/* Answer input skeleton */}
                <div className="h-32 bg-gray-200 rounded w-full mb-6"></div>

                {/* Buttons skeleton */}
                <div className="flex items-center gap-4">
                  <div className="h-9 bg-gray-200 rounded w-32"></div>
                  <div className="h-9 bg-gray-200 rounded w-48"></div>
                </div>
              </div>
            )}
          </div>

          {/* Youtube video suggestions section */}
          <div className="flex flex-col space-y-6 h-full">
            <div
              className={`flex flex-col space-y-6 transition-all duration-300 ease-in-out mt-auto ${
                isVideosVisible ? "translate-y-[0.2vh]" : "translate-y-[17vh]"
              } overflow-y-clip`}
            >
              <div
                className="flex items-center space-x-2 text-[#333333] flex-col hover:cursor-pointer"
                onClick={() => {
                  if(isVideosVisible) {
                    setIsVideosVisible(false);
                  } else if(!isVideosVisible && videoSuggestions.length > 0) {
                    setIsVideosVisible(true);
                  }
                }}
              >
                <FiChevronDown
                  size={20}
                  className={`transition-transform duration-300 ${
                    isVideosVisible ? "" : "rotate-180"
                  }`}
                />
                <p className="text-sm font-medium">Suggested YouTube videos</p>
              </div>
              <div className="flex space-x-4 pb-3 pr-1 max-w-full mt-auto text-black overflow-x-scroll">
                {videoSuggestions.map((video) => (
                  <a key={video.videoId} href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" className="h-28 min-w-44 border border-[#333333] rounded-md shadow-[2px_3px_0_0px_rgba(51,51,51,1)]">
                    <Image
                    className="w-full h-full object-cover rounded-md border border-white"
                    src={video.thumbnailUrl}
                    alt="Youtube"
                    width={100}
                    height={100}
                    />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Chat Section */}
        <div className="lg:border-l lg:border-gray-200 lg:dark:border-gray-700 lg:pl-8">
          <ChatWithAI
            currentQuestionChat={currentQuestionChat}
            setCurrentQuestionChat={setCurrentQuestionChat}
            courseId={params.course_id as string}
            questionContext={
              currentQuestionData
                ? buildChatContext(currentParts, currentPart)
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
